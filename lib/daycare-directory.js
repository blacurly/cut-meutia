import { FACILITY_TAGS, facilityLabel } from "./daycare-facilities.js";

export const PROVINCE_NAMES = { "31": "DKI Jakarta", "32": "Jawa Barat", "35": "Jawa Timur" };

// Labels describe the evidence in the source data, never an Ayomi decision.
export const LEGAL_STATUS = {
  referenced: { label: "Ada referensi izin publik", tone: "green" },
  claimed_without_reference: { label: "Referensi izin belum spesifik", tone: "neutral" },
  in_review: { label: "Legalitas sedang dicek", tone: "amber" },
  not_available: { label: "Belum ada data legalitas", tone: "neutral" },
};

export const SORT_OPTIONS = {
  recommended: "Paling lengkap & terpercaya",
  rating: "Rating publik tertinggi",
  name: "Nama A–Z",
};
export const RATING_OPTIONS = ["4.5", "4"];

export const PARTNER_COLUMNS = "id,slug,name,description,address,province_code,city_code,district_code,facilities,daily_capacity,status";
export const LISTING_COLUMNS = "id,slug,name,province_name,city_name,district_name,address,postal_code,facilities_text,facility_tags,public_rating,public_rating_source,legal_status,legal_reference,legal_reference_url,npsn,data_quality_notes,cover_image_path,claimed_daycare_id";

const MEDIA_BUCKET = "daycare-public-media";
const NPSN_LOOKUP = "https://referensi.data.kemendikdasmen.go.id/pendidikan/npsn/";

export function publicMediaUrl(path, baseUrl) {
  if (!path || !baseUrl) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/${encoded}`;
}

// Partner daycares (public.daycares). Map only stored fields; no demo metrics.
export function toDirectoryDaycare(row) {
  const features = Array.isArray(row.facilities) ? row.facilities : row.facilities?.features ?? [];
  return {
    id: row.id, slug: row.slug, name: row.name, description: row.description,
    address: row.address, province: PROVINCE_NAMES[row.province_code] || row.province_code, city: row.city_code,
    district: row.district_code, source: "supabase", kind: "partner",
    facilities: features.map(feature => typeof feature === "string" ? feature : feature.key).filter(Boolean),
    facilityLabels: features.map(feature => typeof feature === "string" ? feature : feature.label).filter(Boolean),
    capacity: row.daily_capacity, status: row.status,
  };
}

// Public catalog entries (public.daycare_listings).
export function toListingDaycare(row, { mediaBaseUrl } = {}) {
  const tags = Array.isArray(row.facility_tags) ? row.facility_tags.filter(tag => Object.hasOwn(FACILITY_TAGS, tag)) : [];
  return {
    id: row.id, slug: row.slug, name: row.name, source: "supabase", kind: "listing",
    address: row.address, postalCode: row.postal_code,
    province: row.province_name, city: row.city_name, district: row.district_name,
    description: row.facilities_text, facilitiesText: row.facilities_text,
    facilities: tags, facilityLabels: tags.map(facilityLabel),
    rating: row.public_rating == null ? null : Number(row.public_rating),
    ratingSource: row.public_rating_source,
    legalStatus: Object.hasOwn(LEGAL_STATUS, row.legal_status) ? row.legal_status : "not_available",
    legalReference: row.legal_reference,
    legalReferenceUrl: row.legal_reference_url || (row.npsn ? `${NPSN_LOOKUP}${row.npsn}` : null),
    dataNotes: Array.isArray(row.data_quality_notes) ? row.data_quality_notes : [],
    coverImageUrl: publicMediaUrl(row.cover_image_path, mediaBaseUrl),
    claimedDaycareId: row.claimed_daycare_id,
  };
}

const sameName = (a, b) => a.toLocaleLowerCase("id").replace(/[^a-z0-9]/g, "") === b.toLocaleLowerCase("id").replace(/[^a-z0-9]/g, "");

// A claimed listing is shown once, as the partner daycare.
export function mergeDirectory(partners, listings) {
  const claimed = new Set(partners.map(partner => partner.id));
  return [
    ...partners,
    ...listings.filter(listing => !claimed.has(listing.claimedDaycareId) && !partners.some(partner => sameName(partner.name, listing.name))),
  ];
}

export function parseDirectoryFilters(source = {}) {
  const get = key => {
    const value = source instanceof URLSearchParams ? source.get(key) : source[key];
    return typeof value === "string" ? value.slice(0, 100).trim() : "";
  };
  return {
    q: get("q"), province: get("province"), city: get("city"), district: get("district"),
    facilities: [...new Set(get("facilities").split(",").filter(key => Object.hasOwn(FACILITY_TAGS, key)))],
    legal: get("legal") === "referenced" ? "referenced" : "",
    minRating: RATING_OPTIONS.includes(get("minRating")) ? get("minRating") : "",
    sort: Object.hasOwn(SORT_OPTIONS, get("sort")) ? get("sort") : "recommended",
  };
}

// Transparent, rule-based ordering (no AI): partners first, then listings with
// a public licence reference, then higher public rating, then name.
export function recommendationScore(daycare) {
  if (daycare.kind === "partner") return 100;
  const legal = { referenced: 20, in_review: 5 }[daycare.legalStatus] || 0;
  return legal + (daycare.rating ?? 0) * 2 + Math.min(daycare.facilities?.length ?? 0, 6) * 0.5;
}

const sorters = {
  recommended: (a, b) => recommendationScore(b) - recommendationScore(a),
  rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1),
  name: () => 0,
};

export function filterDirectoryDaycares(filters, daycares) {
  const query = filters.q.toLocaleLowerCase("id");
  const minRating = filters.minRating ? Number(filters.minRating) : null;
  const sorter = sorters[filters.sort] || sorters.recommended;
  return daycares.filter(daycare =>
    (!query || [daycare.name, daycare.address, daycare.city, daycare.district].filter(Boolean).join(" ").toLocaleLowerCase("id").includes(query)) &&
    (!filters.province || daycare.province === filters.province) &&
    (!filters.city || daycare.city === filters.city) &&
    (!filters.district || daycare.district === filters.district) &&
    (!filters.legal || daycare.kind === "partner" || daycare.legalStatus === filters.legal) &&
    (minRating == null || (daycare.rating != null && daycare.rating >= minRating)) &&
    filters.facilities.every(key => daycare.facilities.includes(key))
  ).sort((a, b) => sorter(a, b) || a.name.localeCompare(b.name, "id"));
}

export function directoryQuery(filters) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    const text = Array.isArray(value) ? value.join(",") : value;
    if (text && !(key === "sort" && text === "recommended")) query.set(key, text);
  }
  return query.toString();
}
