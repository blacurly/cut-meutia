// Map only fields selected from the daycares table. No demo metrics.
export function toDirectoryDaycare(row) {
  const features = Array.isArray(row.facilities) ? row.facilities : row.facilities?.features ?? [];
  return {
    id: row.id, slug: row.slug, name: row.name, description: row.description,
    address: row.address, province: row.province_code, city: row.city_code,
    district: row.district_code, source: "supabase",
    facilities: features.map(feature => typeof feature === "string" ? feature : feature.key).filter(Boolean),
    facilityLabels: features.map(feature => typeof feature === "string" ? feature : feature.label).filter(Boolean),
    capacity: row.daily_capacity, status: row.status,
  };
}

export function parseDirectoryFilters(source = {}) {
  const get = key => {
    const value = source instanceof URLSearchParams ? source.get(key) : source[key];
    return typeof value === "string" ? value.slice(0, 100).trim() : "";
  };
  return {
    q: get("q"), province: get("province"), city: get("city"), district: get("district"),
    facilities: [...new Set(get("facilities").split(",").filter(Boolean))],
  };
}

export function filterDirectoryDaycares(filters, daycares) {
  const query = filters.q.toLocaleLowerCase("id");
  return daycares.filter(daycare =>
    (!query || [daycare.name, daycare.address, daycare.city].filter(Boolean).join(" ").toLocaleLowerCase("id").includes(query)) &&
    (!filters.province || daycare.province === filters.province) &&
    (!filters.city || daycare.city === filters.city) &&
    (!filters.district || daycare.district === filters.district) &&
    filters.facilities.every(key => daycare.facilities.includes(key))
  ).sort((a, b) => a.name.localeCompare(b.name, "id"));
}
