import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveFacilityTags } from "./daycare-facilities.js";
import {
  buildListings, classifyLegal, extractPostalCode, extractRecords, listingSlug, normalizeDistrict,
  parseCsv, parseRating, PROVINCES, toSeedSql,
} from "./daycare-dataset.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("CSV parser keeps quoted commas, escaped quotes and multi-line cells", () => {
  const rows = parseCsv('a,"b, c","say ""hi""","line 1\nline 2"\r\nx,y\n');
  assert.deepEqual(rows[0], ["a", "b, c", 'say "hi"', "line 1\nline 2"]);
  assert.deepEqual(rows[1], ["x", "y"]);
});

test("records are found by header name across the three file layouts", () => {
  const dki = parseCsv(',,,\n,No.,Kota/Kabupaten,Kecamatan,Nama Daycare,Alamat,Rating,Fasilitas,Dokumen Legalitas,\n,1,Jakarta Selatan,Tebet,Daycare A,Jl. A 12810,"4,8",CCTV,Terverifikasi,NPSN 70054305\n');
  const jatim = parseCsv(',No.,Provinsi,Kabupaten/Kota,Kecamatan,Nama Daycare,Alamat,Rating,Fasilitas,Dokumen Legalitas,\n,7,Jawa Timur,Kota Surabaya,Rungkut,Daycare B,Jl. B,5.0,AC,,\n,,,,,,,,,,\n');
  assert.deepEqual(extractRecords(dki)[0], { no: "1", city: "Jakarta Selatan", district: "Tebet", name: "Daycare A", address: "Jl. A 12810", rating: "4,8", facilities: "CCTV", legal: "Terverifikasi", reference: "NPSN 70054305" });
  assert.equal(extractRecords(jatim).length, 1);
  assert.equal(extractRecords(jatim)[0].city, "Kota Surabaya");
  assert.throws(() => extractRecords(parseCsv("a,b\n1,2\n")), /Header 'No\.'/);
});

test("ratings accept comma decimals and reject values outside 0–5", () => {
  assert.deepEqual(parseRating("4,9"), { rating: 4.9, note: null });
  assert.deepEqual(parseRating("5.0"), { rating: 5, note: null });
  for (const empty of ["-", "_", "", undefined]) assert.equal(parseRating(empty).rating, null);
  const outOfScale = parseRating("5,3");
  assert.equal(outOfScale.rating, null);
  assert.match(outOfScale.note, /di luar skala/);
});

test("districts are normalized and postal codes are checked against the province", () => {
  assert.equal(normalizeDistrict("KEC. SETIA BUDI"), "Setiabudi");
  assert.equal(normalizeDistrict("GEMPOL"), "Gempol");
  assert.equal(normalizeDistrict("Bekasi utara"), "Bekasi Utara");
  assert.equal(normalizeDistrict("  "), null);
  assert.deepEqual(extractPostalCode("Jl. Tebet No. 15, Jakarta 12810.", PROVINCES.dki), { postalCode: "12810", note: null });
  assert.match(extractPostalCode("Bukit Cirendeu, Jakarta 15419", PROVINCES.dki).note, /tidak berada di DKI Jakarta/);
  assert.equal(extractPostalCode("Jl. Tanpa Kode Pos", PROVINCES.jatim).postalCode, null);
});

test("legal status reflects the evidence, not the source label", () => {
  const npsnUrl = classifyLegal("Terverifikasi", "https://referensi.data.kemendikdasmen.go.id/pendidikan/npsn/70054305?utm_source=chatgpt.com");
  assert.equal(npsnUrl.legalStatus, "referenced");
  assert.equal(npsnUrl.npsn, "70054305");
  assert.equal(npsnUrl.legalReferenceUrl, "https://referensi.data.kemendikdasmen.go.id/pendidikan/npsn/70054305");
  assert.equal(npsnUrl.legalReference, "NPSN 70054305");

  const generic = classifyLegal("Terverifikasi", "https://data.kemendikdasmen.go.id/data-induk/satpen/050000/daftar?utm_source=chatgpt.com&keyword=day+care");
  assert.equal(generic.legalStatus, "claimed_without_reference");
  assert.match(generic.notes[0], /halaman pencarian/);

  assert.equal(classifyLegal("Terverifikasi", "").legalStatus, "claimed_without_reference");
  assert.equal(classifyLegal("Proses Verifikasi", "").legalStatus, "in_review");
  assert.equal(classifyLegal("Tidak Ada", "").legalStatus, "not_available");
  assert.equal(classifyLegal("Terverifikasi", "https://pdki-indonesia.dgip.go.id/search", { weakReference: "Merek" }).legalStatus, "claimed_without_reference");
  assert.equal(classifyLegal("Terverifikasi", "No. SK Operasional: 3/A.6/2021").legalStatus, "referenced");
});

test("facility tags come from keywords; '24 jam' CCTV is not 24-hour care", () => {
  assert.deepEqual(deriveFacilityTags("CCTV 24 Jam, Ruangan Ber-AC"), ["cctv", "ac"]);
  assert.ok(deriveFacilityTags("Penitipan hingga 24 jam").includes("extended_hours"));
  assert.ok(deriveFacilityTags("Baby spa, makan siang, Montessori").includes("montessori"));
  assert.deepEqual(deriveFacilityTags(""), []);
});

test("slugs include the city once and stay unique", () => {
  assert.equal(listingSlug("Azzahra Daycare Banyuwangi", "Kabupaten Banyuwangi"), "azzahra-daycare-banyuwangi");
  assert.equal(listingSlug("TPA Mika Daycare", "Jakarta Selatan"), "tpa-mika-daycare-jakarta-selatan");
  const csv = text => `,No.,Kota/Kabupaten,Kecamatan,Nama Daycare,Alamat,Rating,Fasilitas,Dokumen Legalitas,\n${text}`;
  const { listings } = buildListings({
    dki: csv(",1,Jakarta Selatan,Tebet,Daycare Sama,Jl. Satu 12810,4.5,CCTV,,\n,2,Jakarta Selatan,Tebet,Daycare Sama,Jl. Dua 12810,4.6,AC,,\n"),
  });
  assert.deepEqual(listings.map(l => l.slug), ["daycare-sama-jakarta-selatan", "daycare-sama-jakarta-selatan-2"]);
});

test("corrections can exclude rows outside the three focus provinces", () => {
  const header = ",No.,Kabupaten/Kota,Kecamatan,Nama Daycare,Alamat,Rating,Fasilitas,Dokumen Legalitas,\n";
  const { listings, excluded } = buildListings({ jabar: `${header},10,kota Tangerang,Cikarang,Smiley,Jl. Elang 15224,-,CCTV,Terverifikasi,\n` });
  assert.equal(listings.length, 0);
  assert.match(excluded[0].reason, /Banten/);
});

test("seed SQL escapes quotes and is an idempotent upsert", () => {
  const header = ",No.,Kota/Kabupaten,Kecamatan,Nama Daycare,Alamat,Rating,Fasilitas,Dokumen Legalitas,\n";
  const { listings } = buildListings({ dki: `${header},1,Jakarta Barat,Kebon Jeruk,B'Kids Daycare,Jl. Surya 11520,-,Area bermain,Tidak Ada,\n` });
  const sql = toSeedSql(listings);
  assert.match(sql, /'B''Kids Daycare'/);
  assert.match(sql, /ON CONFLICT \(source_dataset, source_row\) DO UPDATE SET/);
  assert.match(sql, /^-- GENERATED/);
  assert.match(sql.trim(), /COMMIT;$/);
});

test("committed seed matches the migration and contains only the three provinces", async () => {
  const seed = await readFile(path.join(root, "supabase", "seed", "daycare_listings_seed.sql"), "utf8");
  const rows = seed.match(/^\s+\('(dki|jabar|jatim)', \d+,/gm) || [];
  assert.equal(rows.length, 104);
  assert.doesNotMatch(seed, /Tangerang Selatan', 'Cikarang|smiley-kids/i);
  assert.doesNotMatch(seed, /utm_source/);
});

test("migration 039 enables RLS and only grants public reads", async () => {
  const sql = await readFile(path.join(root, "supabase", "migrations", "039_daycare_listings.sql"), "utf8");
  assert.match(sql, /ALTER TABLE public\.daycare_listings ENABLE ROW LEVEL SECURITY;/);
  assert.match(sql, /FOR SELECT\s+TO anon, authenticated\s+USING \(visibility = 'published'\)/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.daycare_listings FROM PUBLIC, anon, authenticated;/);
  assert.match(sql, /GRANT SELECT ON TABLE public\.daycare_listings TO anon, authenticated;/);
  assert.doesNotMatch(sql, /GRANT (INSERT|UPDATE|DELETE)/);
});
