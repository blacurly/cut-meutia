// Synthetic operational profile for public catalog entries (daycare_listings).
//
// The public CSV datasets contain name, address, facilities, rating and legal
// references only. Fees, caregiver ratio, capacity, age range and opening
// hours are not public, so they are GENERATED here for development and demo.
// Every generated profile is stored with data_origin = 'synthetic' and the UI
// must label it as an estimate. A daycare manager replaces it with real data
// (data_origin = 'manager') after claiming the listing.
//
// Generation is deterministic: the same slug always yields the same profile,
// so re-running the seed does not reshuffle numbers.
import { FACILITY_TAGS } from "./daycare-facilities.js";

export const SYNTHETIC_GENERATOR_VERSION = "synthetic-v1";

// Stock illustrations already shipped in /public/images. They are generic AI
// illustrations, never photos of a specific daycare.
export const ILLUSTRATION_IMAGES = [
  "/images/daycare-room.webp",
  "/images/daycare-garden.webp",
  "/images/ayomi-daycare.webp",
];

// Monthly full-day fee band (IDR) per province, before adjustments.
const FEE_BANDS = {
  "31": [2_500_000, 5_000_000], // DKI Jakarta
  "32": [1_500_000, 3_500_000], // Jawa Barat
  "35": [1_200_000, 3_000_000], // Jawa Timur
};
const METRO_CITIES = /bekasi|depok|bogor|bandung|surabaya|sidoarjo|malang|tangerang/i;
const PREMIUM_TAGS = ["montessori", "bilingual", "spa", "ac", "cctv"];

function hash(text) {
  let h = 2166136261;
  for (const char of String(text)) {
    h ^= char.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32: small, deterministic PRNG.
export function seededRandom(seed) {
  let state = hash(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const roundTo = (value, step) => Math.round(value / step) * step;
const pick = (random, items) => items[Math.floor(random() * items.length)];
const between = (random, min, max) => min + random() * (max - min);

export function ageLabel(months) {
  if (months < 12) return `${months} bulan`;
  return months % 12 === 0 ? `${months / 12} tahun` : `${(months / 12).toLocaleString("id-ID", { maximumFractionDigits: 1 })} tahun`;
}

function describe(listing, profile) {
  const place = [listing.district_name, listing.city_name].filter(Boolean).join(", ");
  const labels = (listing.facility_tags || []).filter(tag => Object.hasOwn(FACILITY_TAGS, tag)).slice(0, 3)
    .map(tag => FACILITY_TAGS[tag].toLocaleLowerCase("id"));
  const focus = labels.length ? ` Layanan yang tercatat di sumber publik antara lain ${labels.join(", ")}.` : "";
  return `${listing.name} adalah layanan penitipan anak di ${place || listing.province_name}.`
    + ` Menerima anak usia ${ageLabel(profile.age_min_months)} hingga ${ageLabel(profile.age_max_months)}`
    + ` dengan satu pengasuh untuk setiap ${profile.caregiver_ratio} anak.${focus}`;
}

/**
 * @param {{slug: string, name: string, province_code: string, province_name?: string,
 *          city_name?: string, district_name?: string, facility_tags?: string[]}} listing
 */
export function syntheticProfile(listing) {
  const random = seededRandom(listing.slug);
  const tags = new Set(listing.facility_tags || []);
  const [low, high] = FEE_BANDS[listing.province_code] || FEE_BANDS["35"];

  let monthly = between(random, low, high);
  if (METRO_CITIES.test(listing.city_name || "")) monthly *= 1.12;
  monthly *= 1 + 0.05 * PREMIUM_TAGS.filter(tag => tags.has(tag)).length;
  const monthlyMin = roundTo(Math.min(monthly, high * 1.3), 50_000);
  const monthlyMax = roundTo(monthlyMin * between(random, 1.2, 1.6), 50_000);
  const dailyFee = roundTo((monthlyMin / 20) * between(random, 1.3, 1.5), 5_000);
  const halfDay = roundTo(monthlyMin * 0.65, 50_000);

  // Infants need closer supervision, so the ratio is lower when accepted.
  const caregiverRatio = tags.has("infant") ? pick(random, [3, 3, 4]) : pick(random, [4, 5, 5, 6]);
  const dailyCapacity = pick(random, [15, 20, 25, 30, 40, 50, 60]);
  const ageMin = tags.has("infant") ? pick(random, [3, 6]) : pick(random, [12, 18, 24]);
  const ageMax = tags.has("preschool") ? 72 : pick(random, [48, 60, 72]);
  const allDay = tags.has("extended_hours");
  const opening = allDay ? "00:00" : pick(random, ["06:30", "07:00", "07:30"]);
  const closing = allDay ? "23:59" : pick(random, ["16:30", "17:00", "17:30", "18:00"]);
  const days = allDay ? "Setiap hari" : pick(random, ["Senin–Jumat", "Senin–Jumat", "Senin–Sabtu"]);
  const hours = `${opening.replace(":", ".")}–${closing.replace(":", ".")}`;
  const start = hash(listing.slug) % ILLUSTRATION_IMAGES.length;

  const profile = {
    data_origin: "synthetic",
    generator_version: SYNTHETIC_GENERATOR_VERSION,
    monthly_fee_min: monthlyMin,
    monthly_fee_max: monthlyMax,
    daily_fee: dailyFee,
    registration_fee: roundTo(between(random, 250_000, 1_500_000), 50_000),
    caregiver_ratio: caregiverRatio,
    caregiver_count: Math.ceil(dailyCapacity / caregiverRatio),
    daily_capacity: dailyCapacity,
    age_min_months: ageMin,
    age_max_months: ageMax,
    opening_time: opening,
    closing_time: closing,
    operating_days: days,
    packages: [
      { code: "daily", name: "Harian", unit: "hari", price: dailyFee, hours },
      { code: "monthly_half", name: "Bulanan setengah hari", unit: "bulan", price: halfDay, hours: allDay ? "6 jam per hari" : `${opening.replace(":", ".")}–12.00` },
      { code: "monthly_full", name: "Bulanan penuh", unit: "bulan", price: monthlyMin, hours },
    ],
    gallery_images: ILLUSTRATION_IMAGES.map((_, index) => ILLUSTRATION_IMAGES[(start + index) % ILLUSTRATION_IMAGES.length]),
  };
  return { ...profile, description: describe(listing, profile) };
}

const sqlText = value => value == null ? "NULL" : `'${String(value).replace(/'/g, "''")}'`;
const sqlArray = items => `ARRAY[${items.map(sqlText).join(", ")}]::text[]`;

// Upserts keyed by slug so the seed works on any environment where the
// catalog seed (039) has been loaded. Manager-entered profiles are never
// overwritten (data_origin <> 'synthetic').
export function toProfileSeedSql(listings) {
  const rows = listings.map(listing => {
    const p = syntheticProfile(listing);
    return `  (${[
      sqlText(listing.slug), sqlText(p.generator_version), sqlText(p.description),
      p.monthly_fee_min, p.monthly_fee_max, p.daily_fee, p.registration_fee,
      p.caregiver_ratio, p.caregiver_count, p.daily_capacity, p.age_min_months, p.age_max_months,
      sqlText(p.opening_time), sqlText(p.closing_time), sqlText(p.operating_days),
      `${sqlText(JSON.stringify(p.packages))}::jsonb`, sqlArray(p.gallery_images),
    ].join(", ")})`;
  });
  return [
    "-- GENERATED by scripts/build-synthetic-profiles.mjs from lib/daycare-synthetic.js.",
    "-- Synthetic (non-official) fees, ratio, capacity, ages and hours for the public",
    "-- catalog. Run after migration 041 and the catalog seed. Idempotent; rows a",
    "-- manager has replaced (data_origin <> 'synthetic') are left untouched.",
    "BEGIN;",
    "INSERT INTO public.daycare_listing_profiles (",
    "  listing_id, data_origin, generator_version, description,",
    "  monthly_fee_min, monthly_fee_max, daily_fee, registration_fee,",
    "  caregiver_ratio, caregiver_count, daily_capacity, age_min_months, age_max_months,",
    "  opening_time, closing_time, operating_days, packages, gallery_images",
    ")",
    "SELECT l.id, 'synthetic', v.generator_version, v.description,",
    "  v.monthly_fee_min, v.monthly_fee_max, v.daily_fee, v.registration_fee,",
    "  v.caregiver_ratio, v.caregiver_count, v.daily_capacity, v.age_min_months, v.age_max_months,",
    "  v.opening_time::time, v.closing_time::time, v.operating_days, v.packages, v.gallery_images",
    "FROM (VALUES",
    rows.join(",\n"),
    ") AS v (slug, generator_version, description, monthly_fee_min, monthly_fee_max, daily_fee,",
    "        registration_fee, caregiver_ratio, caregiver_count, daily_capacity, age_min_months,",
    "        age_max_months, opening_time, closing_time, operating_days, packages, gallery_images)",
    "JOIN public.daycare_listings AS l ON l.slug = v.slug",
    "ON CONFLICT (listing_id) DO UPDATE SET",
    "  generator_version = EXCLUDED.generator_version, description = EXCLUDED.description,",
    "  monthly_fee_min = EXCLUDED.monthly_fee_min, monthly_fee_max = EXCLUDED.monthly_fee_max,",
    "  daily_fee = EXCLUDED.daily_fee, registration_fee = EXCLUDED.registration_fee,",
    "  caregiver_ratio = EXCLUDED.caregiver_ratio, caregiver_count = EXCLUDED.caregiver_count,",
    "  daily_capacity = EXCLUDED.daily_capacity, age_min_months = EXCLUDED.age_min_months,",
    "  age_max_months = EXCLUDED.age_max_months, opening_time = EXCLUDED.opening_time,",
    "  closing_time = EXCLUDED.closing_time, operating_days = EXCLUDED.operating_days,",
    "  packages = EXCLUDED.packages, gallery_images = EXCLUDED.gallery_images, updated_at = now()",
    "WHERE public.daycare_listing_profiles.data_origin = 'synthetic';",
    "COMMIT;",
    "",
  ].join("\n");
}
