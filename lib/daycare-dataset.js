// Cleans the team's daycare CSV datasets (DKI Jakarta, Jawa Barat, Jawa Timur)
// into rows for public.daycare_listings. Pure functions only; file IO lives in
// scripts/build-daycare-seed.mjs.
import { deriveFacilityTags } from "./daycare-facilities.js";

export const PROVINCES = {
  dki: { code: "31", name: "DKI Jakarta", postal: [[10000, 14999]] },
  jabar: { code: "32", name: "Jawa Barat", postal: [[16000, 17999], [40000, 46999]] },
  jatim: { code: "35", name: "Jawa Timur", postal: [[60000, 69999]] },
};

export const RATING_SOURCE = "Rating ulasan publik daring dari dataset tim Ayomi";

// Manual corrections, keyed by "<dataset>:<No.>". Every change states its reason
// in `notes`, which is stored with the row and shown in the data-quality report.
export const CORRECTIONS = {
  "dki:2": { facilitiesReplace: [["emeriksaan kesehatan", "Pemeriksaan kesehatan"]] },
  "dki:21": { district: "Pasar Minggu", notes: ["Kecamatan dikoreksi sesuai alamat (Cilandak Timur adalah kelurahan)."] },
  "dki:24": { city: "Jakarta Selatan", district: "Kebayoran Baru", notes: ["Wilayah dikoreksi sesuai alamat (SCBD, Senayan, Jakarta Selatan)."] },
  "jatim:5": { facilitiesReplace: [[", CCTV perlu dikonfirmasi", ""]], notes: ["Ketersediaan CCTV belum terkonfirmasi di sumber."] },
  "jatim:7": { facilitiesReplace: [[", NPSN 69922598, akreditasi B", ""]], legalReference: "NPSN 69922598 · Akreditasi B" },
  "jatim:8": { facilitiesReplace: [[", Detail ruang dan perlengkapan perlu dikonfirmasi", ""]], notes: ["Detail ruang dan perlengkapan belum terkonfirmasi di sumber."] },
  "jatim:16": {
    facilitiesReplace: [[", Informasi publik menyebut NPSN 70007881 dan akreditasi B.", ""]],
    legalReferenceAppend: " · NPSN 70007881 · Akreditasi B (informasi publik)",
  },
  "jatim:17": { weakReference: "Referensi berupa pendaftaran merek (PDKI), bukan izin operasional." },
  "jatim:21": { facilitiesReplace: [["uang bermain", "Ruang bermain"]] },
  "jatim:27": { addressReplace: [["erumahan Griya", "Perumahan Griya"]] },
  "jatim:31": { addressReplace: [[" Kecamatan Tuban", ""]] },
  "jabar:1": { notes: ["Alamat sama dengan TK Bina Insan Mandiri (kompleks Islamic Center Bekasi); kemungkinan lembaga yang sama."] },
  "jabar:2": { notes: ["Alamat sama dengan Islamic Preschool Centre Bekasi; kemungkinan lembaga yang sama."] },
  "jabar:4": { district: "Bekasi Utara", notes: ["Kecamatan diisi dari kawasan Summarecon Bekasi; perlu dikonfirmasi."] },
  "jabar:5": { district: null, notes: ["Kecamatan tidak tersedia di sumber."] },
  "jabar:6": { name: "Playschool Montessori Sunny Glow Summarecon Bekasi" },
  "jabar:7": { district: null, notes: ["Kecamatan tidak tersedia di sumber."] },
  "jabar:9": { notes: ["Deskripsi fasilitas memakai templat yang sama dengan entri lain; perlu dicek ulang."] },
  "jabar:10": { exclude: "Alamat berada di Tangerang Selatan (Banten), di luar tiga provinsi fokus." },
  "jabar:12": { notes: ["Deskripsi fasilitas memakai templat yang sama dengan entri lain; perlu dicek ulang."] },
  "jabar:14": { city: "Kota Bandung", notes: ["Kota dikoreksi sesuai alamat (Sukajadi, Kota Bandung).", "Deskripsi fasilitas memakai templat yang sama dengan entri lain; perlu dicek ulang."] },
  "jabar:18": { district: "Bogor Utara", notes: ["Kecamatan dikoreksi sesuai alamat (Ciparigi adalah kelurahan)."] },
  "jabar:23": { district: "Pancoran Mas", notes: ["Nama kecamatan dilengkapi sesuai alamat."] },
};

const DISTRICT_ALIASES = { "Setia Budi": "Setiabudi" };
const WEAK_REFERENCE = [
  [/data-induk\/satpen\/[^?]*daftar/i, "Tautan sumber hanya halaman pencarian umum, bukan data lembaga spesifik."],
  [/blogspot\./i, "Referensi berupa blog, bukan dokumen izin resmi."],
];

// RFC 4180 parser: quoted fields may contain commas, quotes ("") and newlines.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export const clean = value => String(value ?? "")
  .replace(/\s+/g, " ")
  .replace(/\s+,/g, ",")
  .replace(/^["\s]+|["\s]+$/g, "")
  .trim();

const titleCase = value => value.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep, letter) => sep + letter.toUpperCase());

export function normalizeDistrict(value) {
  const text = clean(value).replace(/^kec(amatan)?\.?\s+/i, "");
  if (!text) return null;
  const titled = titleCase(text);
  return DISTRICT_ALIASES[titled] || titled;
}

export function parseRating(value) {
  const text = clean(value).replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(text)) return { rating: null, note: null };
  const rating = Number(text);
  if (rating < 0 || rating > 5) return { rating: null, note: `Rating sumber (${text}) di luar skala 0–5 sehingga tidak ditampilkan.` };
  return { rating: Math.round(rating * 10) / 10, note: null };
}

export function extractPostalCode(address, province) {
  const matches = clean(address).match(/\b\d{5}\b/g);
  if (!matches) return { postalCode: null, note: null };
  const postalCode = matches.at(-1);
  const number = Number(postalCode);
  const inProvince = province.postal.some(([min, max]) => number >= min && number <= max);
  return inProvince
    ? { postalCode, note: null }
    : { postalCode, note: `Kode pos ${postalCode} tidak berada di ${province.name}; lokasi perlu dikonfirmasi.` };
}

const stripTracking = url => {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) if (key.startsWith("utm_")) parsed.searchParams.delete(key);
    return parsed.toString();
  } catch {
    return null;
  }
};

export function classifyLegal(label, reference, correction = {}) {
  const claim = clean(label).toLowerCase();
  let text = clean(reference);
  if (correction.legalReference) text = correction.legalReference;
  if (correction.legalReferenceAppend) text = `${text}${correction.legalReferenceAppend}`;
  const notes = [];
  const urlMatch = text.match(/https?:\/\/\S+/);
  const url = urlMatch ? stripTracking(urlMatch[0]) : null;
  const npsn = (url?.match(/\/npsn\/([0-9A-Z]{8})\b/i) || text.match(/\bNPSN\s*:?\s*([0-9A-Z]{8})\b/i))?.[1]?.toUpperCase() || null;
  const weak = correction.weakReference || WEAK_REFERENCE.find(([pattern]) => url && pattern.test(url))?.[1];
  const specific = !weak && (npsn || /\bSK\b|izin operasional|AHU-/i.test(text));

  let status;
  if (specific) status = "referenced";
  else if (claim.startsWith("proses")) status = "in_review";
  else if (claim === "terverifikasi") status = "claimed_without_reference";
  else status = "not_available";

  if (weak) notes.push(weak);
  if (status === "claimed_without_reference" && !weak) notes.push("Sumber menandai terverifikasi tanpa nomor izin atau NPSN.");
  // Show the human-readable part; a bare lookup URL becomes "NPSN <id>".
  const readable = clean(text.replace(/https?:\/\/\S+/g, ""));
  return {
    legalStatus: status,
    legalReference: specific ? readable || (npsn ? `NPSN ${npsn}` : null) : null,
    legalReferenceUrl: specific && url ? url : null,
    npsn: specific ? npsn : null,
    notes,
  };
}

export const slugify = value => clean(value)
  .normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/&/g, " dan ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// "<name>-<city>" keeps branches with the same name apart; skip the city
// when the name already ends with it.
export function listingSlug(name, city) {
  const base = slugify(name);
  const place = slugify(city.replace(/^(Kota|Kabupaten)\s+/i, ""));
  return base.endsWith(place) ? base : `${base}-${place}`;
}

// Locate the header row ("No.") and map columns by name, because the three
// files have different leading columns.
export function extractRecords(rows) {
  const headerIndex = rows.findIndex(row => row.some(cell => clean(cell) === "No."));
  if (headerIndex === -1) throw new Error("Header 'No.' tidak ditemukan.");
  const header = rows[headerIndex].map(clean);
  const col = name => header.indexOf(name);
  const legalCol = col("Dokumen Legalitas");
  const index = {
    no: col("No."), city: col("Kabupaten/Kota") >= 0 ? col("Kabupaten/Kota") : col("Kota/Kabupaten"),
    district: col("Kecamatan"), name: col("Nama Daycare"), address: col("Alamat"), rating: col("Rating"),
    facilities: col("Fasilitas"), legal: legalCol, reference: legalCol + 1,
  };
  for (const [key, value] of Object.entries(index)) if (value < 0) throw new Error(`Kolom ${key} tidak ditemukan.`);
  return rows.slice(headerIndex + 1)
    .filter(row => /^\d+$/.test(clean(row[index.no])) && clean(row[index.name]))
    .map(row => Object.fromEntries(Object.entries(index).map(([key, i]) => [key, row[i] ?? ""])));
}

const applyReplacements = (text, pairs = []) => pairs.reduce((value, [from, to]) => value.split(from).join(to), text);

export function normalizeRecord(record, datasetKey, corrections = CORRECTIONS) {
  const province = PROVINCES[datasetKey];
  const sourceRow = Number(clean(record.no));
  const correction = corrections[`${datasetKey}:${sourceRow}`] || {};
  if (correction.exclude) return { excluded: true, sourceRow, name: clean(record.name), reason: correction.exclude };

  const notes = [];
  const name = correction.name || clean(record.name);
  const city = titleCase(clean(correction.city ?? record.city)).replace(/^Dki /, "DKI ");
  const district = Object.hasOwn(correction, "district") ? correction.district : normalizeDistrict(record.district);
  const address = clean(applyReplacements(clean(record.address), correction.addressReplace));
  const facilitiesText = clean(applyReplacements(clean(record.facilities), correction.facilitiesReplace));
  const { rating, note: ratingNote } = parseRating(record.rating);
  const { postalCode, note: postalNote } = extractPostalCode(address, province);
  const legal = classifyLegal(record.legal, record.reference, correction);

  if (ratingNote) notes.push(ratingNote);
  if (postalNote) notes.push(postalNote);
  notes.push(...legal.notes, ...(correction.notes || []));

  return {
    excluded: false,
    sourceDataset: datasetKey,
    sourceRow,
    slug: listingSlug(name, city),
    name,
    provinceCode: province.code,
    provinceName: province.name,
    cityName: city,
    districtName: district,
    address,
    postalCode,
    facilitiesText,
    facilityTags: deriveFacilityTags(facilitiesText),
    publicRating: rating,
    publicRatingSource: rating == null ? null : RATING_SOURCE,
    legalStatus: legal.legalStatus,
    legalReference: legal.legalReference,
    legalReferenceUrl: legal.legalReferenceUrl,
    npsn: legal.npsn,
    dataQualityNotes: notes,
  };
}

// Same facility text on several rows usually means a copy-paste template.
export function flagDuplicateFacilities(listings) {
  const groups = new Map();
  for (const listing of listings) {
    const key = listing.facilitiesText.toLowerCase();
    if (key.length >= 40) groups.set(key, [...(groups.get(key) || []), listing]);
  }
  const note = "Deskripsi fasilitas identik dengan entri lain; perlu dicek ulang.";
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const listing of group) if (!listing.dataQualityNotes.some(n => n.startsWith("Deskripsi fasilitas"))) listing.dataQualityNotes.push(note);
  }
  return listings;
}

export function ensureUniqueSlugs(listings) {
  const seen = new Map();
  for (const listing of listings) {
    const count = (seen.get(listing.slug) || 0) + 1;
    seen.set(listing.slug, count);
    if (count > 1) listing.slug = `${listing.slug}-${count}`;
  }
  return listings;
}

export function buildListings(datasets) {
  const listings = [], excluded = [];
  for (const [datasetKey, text] of Object.entries(datasets)) {
    for (const record of extractRecords(parseCsv(text))) {
      const result = normalizeRecord(record, datasetKey);
      if (result.excluded) excluded.push({ dataset: datasetKey, ...result });
      else listings.push(result);
    }
  }
  return { listings: ensureUniqueSlugs(flagDuplicateFacilities(listings)), excluded };
}

const sqlText = value => value == null ? "NULL" : `'${String(value).replace(/'/g, "''")}'`;
const sqlArray = values => values.length ? `ARRAY[${values.map(sqlText).join(", ")}]::text[]` : "'{}'::text[]";

export function toSeedSql(listings) {
  const columns = [
    "source_dataset", "source_row", "slug", "name", "province_code", "province_name", "city_name",
    "district_name", "address", "postal_code", "facilities_text", "facility_tags", "public_rating",
    "public_rating_source", "legal_status", "legal_reference", "legal_reference_url", "npsn", "data_quality_notes",
  ];
  const values = listings.map(l => `  (${[
    sqlText(l.sourceDataset), l.sourceRow, sqlText(l.slug), sqlText(l.name), sqlText(l.provinceCode),
    sqlText(l.provinceName), sqlText(l.cityName), sqlText(l.districtName), sqlText(l.address), sqlText(l.postalCode),
    sqlText(l.facilitiesText), sqlArray(l.facilityTags), l.publicRating == null ? "NULL" : l.publicRating.toFixed(1),
    sqlText(l.publicRatingSource), sqlText(l.legalStatus), sqlText(l.legalReference), sqlText(l.legalReferenceUrl),
    sqlText(l.npsn), sqlArray(l.dataQualityNotes),
  ].join(", ")})`);
  const updates = columns.filter(c => !["source_dataset", "source_row"].includes(c)).map(c => `  ${c} = EXCLUDED.${c}`);
  return [
    "-- GENERATED by scripts/build-daycare-seed.mjs. Do not edit by hand; edit",
    "-- lib/daycare-dataset.js (CORRECTIONS) and regenerate instead.",
    "-- Run after migration 039. Re-running updates rows in place (idempotent).",
    "BEGIN;",
    `INSERT INTO public.daycare_listings (\n  ${columns.join(", ")}\n) VALUES`,
    `${values.join(",\n")}`,
    "ON CONFLICT (source_dataset, source_row) DO UPDATE SET",
    `${updates.join(",\n")},\n  updated_at = now();`,
    "COMMIT;",
    "",
  ].join("\n");
}
