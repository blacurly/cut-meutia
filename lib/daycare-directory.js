import { FACILITY_TAGS, facilityLabel } from "./daycare-facilities.js";
import sitePhotos from "./site-photos.json" with { type: "json" };

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
  fee: "Biaya bulanan terendah",
  ratio: "Rasio pengasuh terkecil",
  name: "Nama A–Z",
};
export const RATING_OPTIONS = ["4.5", "4"];
// Monthly budget ceilings (IDR) and children-per-caregiver ceilings.
export const FEE_OPTIONS = ["1500000", "2000000", "3000000", "4000000", "5000000"];
export const RATIO_OPTIONS = ["3", "4", "5", "6"];
export const MAX_COMPARE = 3;

export const PARTNER_COLUMNS = "id,slug,name,description,address,province_code,city_code,district_code,facilities,daily_capacity,status";
const PROFILE_COLUMNS = "data_origin,description,monthly_fee_min,monthly_fee_max,daily_fee,registration_fee,caregiver_ratio,caregiver_count,daily_capacity,age_min_months,age_max_months,opening_time,closing_time,operating_days,packages,gallery_images,gallery_is_illustration";
export const LISTING_COLUMNS = "id,slug,name,province_code,province_name,city_name,district_name,address,postal_code,facilities_text,facility_tags,public_rating,public_rating_source,legal_status,legal_reference,legal_reference_url,npsn,data_quality_notes,cover_image_path,gallery_paths,claimed_daycare_id,"
  + `profile:daycare_listing_profiles(${PROFILE_COLUMNS})`;

const MEDIA_BUCKET = "daycare-public-media";
const NPSN_LOOKUP = "https://referensi.data.kemendikdasmen.go.id/pendidikan/npsn/";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const isUuid = value => typeof value === "string" && UUID.test(value);
export const isDaycareKey = value => typeof value === "string" && value.length <= 120 && (UUID.test(value) || SLUG.test(value));

export function publicMediaUrl(path, baseUrl) {
  if (!path || !baseUrl) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/${encoded}`;
}

// Placeholder region values ("Belum ditentukan") are not shown.
const regionValue = value => (typeof value === "string" && value.trim() && !/^belum ditentukan$/i.test(value.trim()) ? value : null);

// Partner daycares (public.daycares). Map only stored fields.
export function toDirectoryDaycare(row, { approvedPhotos = [], illustrations } = {}) {
  const features = Array.isArray(row.facilities) ? row.facilities : row.facilities?.features ?? [];
  const facilities = features.map(feature => typeof feature === "string" ? feature : feature.key).filter(Boolean);
  const gallery = approvedPhotos.length ? approvedPhotos : sharedIllustrations(row.slug || row.id, illustrations);
  return {
    coverImageUrl: gallery[0]?.url ?? null, coverIsIllustration: gallery[0]?.illustration ?? false, gallery,
    id: row.id, slug: row.slug, name: row.name, description: row.description,
    address: row.address, province: PROVINCE_NAMES[row.province_code] || row.province_code, city: regionValue(row.city_code),
    district: regionValue(row.district_code), source: "supabase", kind: "partner",
    facilities,
    facilityLabels: features.map(feature => typeof feature === "string" ? facilityLabel(feature) : feature.label || facilityLabel(feature.key)).filter(Boolean),
    capacity: row.daily_capacity, status: row.status,
  };
}

const hhmm = value => typeof value === "string" ? value.slice(0, 5).replace(":", ".") : null;
const amount = value => value == null ? null : Number(value);

// Operational profile (041). Synthetic values are flagged so the UI can say
// "estimasi" — they are not information published by the daycare.
function mapProfile(profile) {
  if (!profile) {
    return { profile: null, monthlyFee: null, ratio: null, capacity: null, ageMinMonths: null, ageMaxMonths: null };
  }
  return {
    profile: {
      origin: profile.data_origin,
      estimated: profile.data_origin === "synthetic",
      monthlyFeeMin: amount(profile.monthly_fee_min),
      monthlyFeeMax: amount(profile.monthly_fee_max),
      dailyFee: amount(profile.daily_fee),
      registrationFee: amount(profile.registration_fee),
      caregiverCount: profile.caregiver_count,
      hours: profile.opening_time === "00:00:00" && profile.closing_time?.startsWith("23:59")
        ? "24 jam" : `${hhmm(profile.opening_time)}–${hhmm(profile.closing_time)}`,
      operatingDays: profile.operating_days,
      packages: Array.isArray(profile.packages) ? profile.packages.map(pack => ({ ...pack, price: amount(pack.price) })) : [],
    },
    profileDescription: profile.description,
    monthlyFee: amount(profile.monthly_fee_min),
    ratio: profile.caregiver_ratio,
    capacity: profile.daily_capacity,
    ageMinMonths: profile.age_min_months,
    ageMaxMonths: profile.age_max_months,
  };
}

// Same daycare, same starting picture; different daycares start elsewhere so
// the catalog cards do not all share one cover.
function rotateFor(key, items) {
  if (items.length < 2) return items;
  let hash = 0;
  for (const char of String(key ?? "")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const start = hash % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

// Shared example pictures from /public/images/daycares/ilustrasi.
export function sharedIllustrations(key, pool = sitePhotos.illustrations) {
  const images = Array.isArray(pool) ? pool.filter(url => /^\/images\/[a-z0-9/-]+\.webp$/.test(url)) : [];
  return rotateFor(key, images).map(url => ({ url, illustration: true }));
}

// Real photos win: photos the manager uploaded and Admin approved
// (daycare_photos, passed in as `approvedPhotos`), then Storage paths on the
// listing, then photos the team added under /public/images/daycares/<slug>
// (scripts/process-photos.mjs). Otherwise example pictures, always flagged so
// the UI never presents them as the daycare.
function mapGallery(row, profile, { mediaBaseUrl, localPhotos = sitePhotos.daycares, illustrations = sitePhotos.illustrations, approvedPhotos = [] } = {}) {
  if (approvedPhotos.length) return approvedPhotos;
  const photos = [row.cover_image_path, ...(Array.isArray(row.gallery_paths) ? row.gallery_paths : [])]
    .filter(Boolean).filter((path, index, all) => all.indexOf(path) === index)
    .map(path => ({ url: publicMediaUrl(path, mediaBaseUrl), illustration: false })).filter(photo => photo.url);
  if (photos.length) return photos;
  const local = Array.isArray(localPhotos?.[row.slug]) ? localPhotos[row.slug] : [];
  if (local.length) return local.map(url => ({ url, illustration: false }));
  const shared = sharedIllustrations(row.slug, illustrations);
  if (shared.length) return shared;
  const images = Array.isArray(profile?.gallery_images) ? profile.gallery_images : [];
  return images.filter(path => /^\/images\/[a-z0-9-]+\.(webp|png|jpg)$/.test(path)).map(url => ({ url, illustration: true }));
}

// Public catalog entries (public.daycare_listings + daycare_listing_profiles).
export function toListingDaycare(row, { mediaBaseUrl, localPhotos, illustrations, approvedPhotos } = {}) {
  const tags = Array.isArray(row.facility_tags) ? row.facility_tags.filter(tag => Object.hasOwn(FACILITY_TAGS, tag)) : [];
  const profileRow = Array.isArray(row.profile) ? row.profile[0] : row.profile;
  const { profileDescription, ...profile } = mapProfile(profileRow);
  const gallery = mapGallery(row, profileRow, { mediaBaseUrl, localPhotos, illustrations, approvedPhotos });
  return {
    id: row.id, slug: row.slug, name: row.name, source: "supabase", kind: "listing",
    address: row.address, postalCode: row.postal_code,
    province: row.province_name, city: row.city_name, district: row.district_name,
    description: profileDescription || row.facilities_text, facilitiesText: row.facilities_text,
    facilities: tags, facilityLabels: tags.map(facilityLabel),
    rating: row.public_rating == null ? null : Number(row.public_rating),
    ratingSource: row.public_rating_source,
    legalStatus: Object.hasOwn(LEGAL_STATUS, row.legal_status) ? row.legal_status : "not_available",
    legalReference: row.legal_reference,
    legalReferenceUrl: row.legal_reference_url || (row.npsn ? `${NPSN_LOOKUP}${row.npsn}` : null),
    dataNotes: Array.isArray(row.data_quality_notes) ? row.data_quality_notes : [],
    coverImageUrl: gallery[0]?.url ?? null,
    coverIsIllustration: gallery[0]?.illustration ?? false,
    gallery,
    claimedDaycareId: row.claimed_daycare_id,
    // Detail view (lib/api/directory.js) sets this to true only when the
    // linked partner daycare is active.
    acceptsEnrollment: false,
    ...profile,
  };
}

const sameName = (a, b) => a.toLocaleLowerCase("id").replace(/[^a-z0-9]/g, "") === b.toLocaleLowerCase("id").replace(/[^a-z0-9]/g, "");

// A claimed listing is shown once, as the partner daycare.
// An active partner that claimed a catalog listing is shown with that
// listing's public profile (catalog id and slug, photos, rating, fees) and
// marked as a partner; enrollment goes to the partner via claimedDaycareId.
// Partners without a listing are shown as they are.
export function mergeDirectory(partners, listings) {
  const used = new Set();
  const merged = partners.map(partner => {
    const listing = listings.find(item => item.claimedDaycareId === partner.id)
      ?? listings.find(item => !item.claimedDaycareId && sameName(item.name, partner.name));
    if (!listing || used.has(listing.id)) return partner;
    used.add(listing.id);
    const facilities = [...new Set([...(listing.facilities ?? []), ...partner.facilities])];
    const ownPhotos = partner.gallery?.some(photo => !photo.illustration)
      ? { gallery: partner.gallery, coverImageUrl: partner.coverImageUrl, coverIsIllustration: false } : {};
    return {
      ...listing, ...ownPhotos, kind: "partner", partnerId: partner.id, claimedDaycareId: partner.id, status: partner.status,
      name: partner.name || listing.name, capacity: partner.capacity ?? listing.capacity,
      facilities, facilityLabels: facilities.map(facilityLabel),
    };
  });
  const partnerIds = new Set(partners.map(partner => partner.id));
  return [
    ...merged,
    ...listings.filter(listing => !used.has(listing.id) && !partnerIds.has(listing.claimedDaycareId)
      && !partners.some(partner => sameName(partner.name, listing.name))),
  ];
}

export function parseDirectoryFilters(source = {}) {
  const get = key => {
    const value = source instanceof URLSearchParams ? source.get(key) : source[key];
    return typeof value === "string" ? value.slice(0, 100).trim() : "";
  };
  const age = get("ageMonths");
  return {
    q: get("q"), province: get("province"), city: get("city"), district: get("district"),
    facilities: [...new Set(get("facilities").split(",").filter(key => Object.hasOwn(FACILITY_TAGS, key)))],
    legal: get("legal") === "referenced" ? "referenced" : "",
    minRating: RATING_OPTIONS.includes(get("minRating")) ? get("minRating") : "",
    maxFee: FEE_OPTIONS.includes(get("maxFee")) ? get("maxFee") : "",
    maxRatio: RATIO_OPTIONS.includes(get("maxRatio")) ? get("maxRatio") : "",
    ageMonths: /^\d{1,2}$/.test(age) && Number(age) <= 84 ? age : "",
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

const ascending = key => (a, b) => (a[key] ?? Infinity) - (b[key] ?? Infinity);
const sorters = {
  recommended: (a, b) => recommendationScore(b) - recommendationScore(a),
  rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1),
  fee: ascending("monthlyFee"),
  ratio: ascending("ratio"),
  name: () => 0,
};

// Entries without a value are excluded by the fee, ratio and age filters:
// "unknown" must not be presented as "within budget".
export function filterDirectoryDaycares(filters, daycares) {
  const query = filters.q.toLocaleLowerCase("id");
  const minRating = filters.minRating ? Number(filters.minRating) : null;
  const maxFee = filters.maxFee ? Number(filters.maxFee) : null;
  const maxRatio = filters.maxRatio ? Number(filters.maxRatio) : null;
  const age = filters.ageMonths ? Number(filters.ageMonths) : null;
  const sorter = sorters[filters.sort] || sorters.recommended;
  return daycares.filter(daycare =>
    (!query || [daycare.name, daycare.address, daycare.city, daycare.district].filter(Boolean).join(" ").toLocaleLowerCase("id").includes(query)) &&
    (!filters.province || daycare.province === filters.province) &&
    (!filters.city || daycare.city === filters.city) &&
    (!filters.district || daycare.district === filters.district) &&
    (!filters.legal || daycare.kind === "partner" || daycare.legalStatus === filters.legal) &&
    (minRating == null || (daycare.rating != null && daycare.rating >= minRating)) &&
    (maxFee == null || (daycare.monthlyFee != null && daycare.monthlyFee <= maxFee)) &&
    (maxRatio == null || (daycare.ratio != null && daycare.ratio <= maxRatio)) &&
    (age == null || (daycare.ageMinMonths != null && daycare.ageMinMonths <= age && age <= daycare.ageMaxMonths)) &&
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

// ------------------------------------------------------------- comparison

export const rupiah = value => value == null ? null
  : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
export const ageText = months => months == null ? null
  : months < 12 ? `${months} bln` : `${Number((months / 12).toFixed(1)).toLocaleString("id-ID")} th`;

// Rows for the side-by-side table. "best" lists the column indexes holding the
// best numeric value (only when at least two daycares have a value).
export function buildComparison(daycares) {
  const row = (key, label, read, { better, estimated = false, format = value => value, missing = "Belum tersedia" } = {}) => {
    const raw = daycares.map(read);
    const known = raw.filter(value => value != null);
    const target = better && known.length >= 2 && new Set(known).size > 1
      ? (better === "min" ? Math.min(...known) : Math.max(...known)) : null;
    return {
      key, label, estimated,
      values: raw.map(value => ({ value, display: value == null ? missing : format(value) })),
      best: target == null ? [] : raw.flatMap((value, index) => value === target ? [index] : []),
    };
  };
  const facilityKeys = Object.keys(FACILITY_TAGS).filter(key => daycares.some(daycare => daycare.facilities?.includes(key)));
  return [
    row("legal", "Status legalitas (sumber publik)", d => d.kind === "partner" ? "Mitra Ayomi" : LEGAL_STATUS[d.legalStatus]?.label ?? null),
    // Only a current, Admin-published score; expired evidence reads as "Belum dinilai".
    row("safety_score", "Safety Score (diverifikasi Ayomi)", d => d.safetyScore?.current ? Number(d.safetyScore.score) : null,
      { better: "max", missing: "Belum dinilai", format: value => `${value.toLocaleString("id-ID")} / 100` }),
    row("rating", "Rating publik", d => d.rating ?? null, { better: "max", format: value => `${value.toLocaleString("id-ID", { minimumFractionDigits: 1 })} / 5` }),
    row("monthly_fee", "Biaya bulanan (mulai dari)", d => d.monthlyFee ?? null, { better: "min", estimated: true, format: rupiah }),
    row("daily_fee", "Biaya harian", d => d.profile?.dailyFee ?? null, { better: "min", estimated: true, format: rupiah }),
    row("registration_fee", "Biaya pendaftaran", d => d.profile?.registrationFee ?? null, { better: "min", estimated: true, format: rupiah }),
    row("ratio", "Rasio pengasuh : anak", d => d.ratio ?? null, { better: "min", estimated: true, format: value => `1 : ${value}` }),
    row("capacity", "Kapasitas harian", d => d.capacity ?? null, { estimated: true, format: value => `${value} anak` }),
    row("ages", "Usia diterima", d => d.ageMinMonths == null ? null : `${ageText(d.ageMinMonths)} – ${ageText(d.ageMaxMonths)}`, { estimated: true }),
    row("hours", "Jam operasional", d => d.profile ? `${d.profile.operatingDays}, ${d.profile.hours}` : null, { estimated: true }),
    row("facility_count", "Jumlah fasilitas tercatat", d => d.facilities?.length ?? 0, { better: "max", format: value => `${value} fasilitas` }),
    ...facilityKeys.map(key => row(`facility:${key}`, FACILITY_TAGS[key], d => d.facilities?.includes(key) ? "Ada" : "Tidak tercatat")),
  ];
}
