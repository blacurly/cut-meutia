import test from "node:test";
import assert from "node:assert/strict";
import {
  buildComparison, directoryQuery, filterDirectoryDaycares, mergeDirectory, parseDirectoryFilters, publicMediaUrl,
  sharedIllustrations, toDirectoryDaycare, toListingDaycare,
} from "./daycare-directory.js";

const partner = toDirectoryDaycare({
  id: "partner-id", slug: "smart-shin-house", name: "Smart Shin House - Daycare", province_code: "35",
  city_code: "Kota Surabaya", district_code: "Sukolilo", facilities: { features: [{ key: "cctv", label: "CCTV" }] },
  daily_capacity: 18, status: "active", main_manager_id: "private-id",
});

const listingRow = (overrides = {}) => ({
  id: "listing-1", slug: "rumah-biru-daycare-tebet", name: "Rumah Biru Daycare Tebet", province_name: "DKI Jakarta",
  city_name: "Jakarta Selatan", district_name: "Tebet", address: "Jl. Tebet Dalam IV H No. 15", postal_code: "12810",
  facilities_text: "CCTV di setiap area, makan sehat", facility_tags: ["cctv", "meals", "unknown_tag"],
  public_rating: "5.0", public_rating_source: "Rating publik", legal_status: "referenced",
  legal_reference: "NPSN 70054305", legal_reference_url: null, npsn: "70054305", data_quality_notes: [],
  cover_image_path: null, claimed_daycare_id: null, ...overrides,
});

test("partner daycares expose stored fields only and map the province code", () => {
  assert.equal(partner.kind, "partner");
  assert.equal(partner.province, "Jawa Timur");
  assert.equal(partner.capacity, 18);
  assert.equal(Object.hasOwn(partner, "main_manager_id"), false);
  for (const field of ["price", "score", "rating", "ratio", "distance"]) assert.equal(Object.hasOwn(partner, field), false);
});

test("listings map to directory entries with honest legal and rating fields", () => {
  const listing = toListingDaycare(listingRow(), { mediaBaseUrl: "https://abc.supabase.co/", illustrations: [] });
  assert.equal(listing.kind, "listing");
  assert.equal(listing.rating, 5);
  assert.deepEqual(listing.facilities, ["cctv", "meals"]);
  assert.deepEqual(listing.facilityLabels, ["CCTV", "Makan & snack"]);
  assert.equal(listing.legalReferenceUrl, "https://referensi.data.kemendikdasmen.go.id/pendidikan/npsn/70054305");
  assert.equal(listing.coverImageUrl, null);
  assert.equal(toListingDaycare(listingRow({ legal_status: "bogus" })).legalStatus, "not_available");
  assert.equal(toListingDaycare(listingRow({ public_rating: null })).rating, null);
});

test("team-added photos replace illustrations but not approved Storage photos", () => {
  const localPhotos = { "rumah-biru-daycare-tebet": ["/images/daycares/rumah-biru-daycare-tebet/1.webp", "/images/daycares/rumah-biru-daycare-tebet/2.webp"] };
  const profile = { gallery_images: ["/images/daycare-room.webp"] };
  const withLocal = toListingDaycare(listingRow({ profile }), { localPhotos });
  assert.equal(withLocal.coverImageUrl, "/images/daycares/rumah-biru-daycare-tebet/1.webp");
  assert.equal(withLocal.coverIsIllustration, false);
  assert.equal(withLocal.gallery.length, 2);
  const withoutLocal = toListingDaycare(listingRow({ profile }), { localPhotos: {}, illustrations: [] });
  assert.equal(withoutLocal.coverIsIllustration, true);
  const stored = toListingDaycare(listingRow({ profile, cover_image_path: "x/cover.webp" }), { mediaBaseUrl: "https://abc.supabase.co", localPhotos });
  assert.match(stored.coverImageUrl, /storage\/v1\/object\/public/);
});

test("example pictures fill in for every daycare without photos, always labelled", () => {
  const illustrations = ["/images/daycares/ilustrasi/1.webp", "/images/daycares/ilustrasi/2.webp", "/images/daycares/ilustrasi/3.webp"];
  const profile = { gallery_images: ["/images/daycare-room.webp"] };
  const one = toListingDaycare(listingRow({ profile }), { localPhotos: {}, illustrations });
  assert.equal(one.gallery.length, 3);
  assert.ok(one.gallery.every(photo => photo.illustration));
  assert.equal(one.coverIsIllustration, true);
  assert.deepEqual([...one.gallery.map(photo => photo.url)].sort(), illustrations);
  // Same daycare, same order on every request.
  assert.deepEqual(toListingDaycare(listingRow({ profile }), { localPhotos: {}, illustrations }).gallery, one.gallery);
  // Unsafe paths in the pool are ignored.
  assert.deepEqual(sharedIllustrations("x", ["https://evil.example/a.webp", "/images/daycares/ilustrasi/1.webp"]),
    [{ url: "/images/daycares/ilustrasi/1.webp", illustration: true }]);
  // Approved manager photos win over everything else.
  const approvedPhotos = [{ url: "https://abc.supabase.co/storage/v1/object/sign/daycare-gallery/d/1.webp?token=t", illustration: false }];
  const real = toListingDaycare(listingRow({ profile, cover_image_path: "x/cover.webp" }), { mediaBaseUrl: "https://abc.supabase.co", illustrations, approvedPhotos });
  assert.deepEqual(real.gallery, approvedPhotos);
  assert.equal(real.coverIsIllustration, false);
});

test("partner daycares get example pictures, and their approved photos replace the catalog ones", () => {
  const row = { id: "p-1", slug: "mitra", name: "Mitra", facilities: [], status: "active" };
  const illustrations = ["/images/daycares/ilustrasi/1.webp"];
  const plain = toDirectoryDaycare(row, { illustrations });
  assert.equal(plain.coverIsIllustration, true);
  const approvedPhotos = [{ url: "https://abc.supabase.co/storage/v1/object/sign/daycare-gallery/p-1/a.webp?token=t", illustration: false }];
  const partner = toDirectoryDaycare(row, { illustrations, approvedPhotos });
  const listing = toListingDaycare(listingRow({ claimed_daycare_id: "p-1" }), { localPhotos: {}, illustrations });
  const [merged] = mergeDirectory([partner], [listing]);
  assert.equal(merged.coverImageUrl, approvedPhotos[0].url);
  assert.equal(merged.coverIsIllustration, false);
  const [withoutPhotos] = mergeDirectory([plain], [listing]);
  assert.equal(withoutPhotos.coverImageUrl, listing.coverImageUrl);
});

test("cover photos resolve to the public bucket URL with an encoded path", () => {
  assert.equal(publicMediaUrl("abc/cover photo.webp", "https://abc.supabase.co"),
    "https://abc.supabase.co/storage/v1/object/public/daycare-public-media/abc/cover%20photo.webp");
  assert.equal(publicMediaUrl(null, "https://abc.supabase.co"), null);
  assert.equal(publicMediaUrl("a.webp", undefined), null);
});

test("a claimed listing is shown once, as the partner with the catalog profile", () => {
  const claimed = toListingDaycare(listingRow({ id: "l-2", slug: "other-daycare", name: "Other", claimed_daycare_id: "partner-id" }));
  const sameName = toListingDaycare(listingRow({ id: "l-3", name: "SMART SHIN HOUSE – Daycare" }));
  const other = toListingDaycare(listingRow());
  const merged = mergeDirectory([partner], [claimed, sameName, other]);
  assert.deepEqual(merged.map(d => d.id), ["l-2", "listing-1"]);
  assert.deepEqual([merged[0].kind, merged[0].slug, merged[0].claimedDaycareId, merged[0].name], ["partner", "other-daycare", "partner-id", "Smart Shin House - Daycare"]);
  assert.ok(merged[0].facilityLabels.includes("CCTV"));
});

test("a partner without a listing stays as is, with readable facility labels", () => {
  const lone = toDirectoryDaycare({ id: "p-2", slug: "demo-x", name: "X", province_code: "31", city_code: "Jakarta Selatan",
    district_code: "Belum ditentukan", facilities: ["ac", "daily_report", "snack_time"], daily_capacity: 10, status: "active" });
  assert.deepEqual(lone.facilityLabels, ["Ruangan ber-AC", "Laporan harian", "Snack time"]);
  assert.equal(lone.district, null);
  assert.deepEqual(mergeDirectory([lone], []).map(d => d.id), ["p-2"]);
});

test("filters validate input and combine legal, rating, region and facility rules", () => {
  const listings = [
    toListingDaycare(listingRow()),
    toListingDaycare(listingRow({ id: "l-2", name: "A Daycare", public_rating: "4.2", legal_status: "not_available", legal_reference: null, npsn: null, facility_tags: ["ac"] })),
    toListingDaycare(listingRow({ id: "l-3", name: "B Daycare", public_rating: null, legal_status: "in_review", legal_reference: null, npsn: null, city_name: "Kota Bekasi", province_name: "Jawa Barat" })),
  ];
  const run = query => filterDirectoryDaycares(parseDirectoryFilters(query), listings).map(d => d.id);
  assert.deepEqual(parseDirectoryFilters({ facilities: "cctv,hack", minRating: "3", legal: "x", sort: "price" }),
    { q: "", province: "", city: "", district: "", facilities: ["cctv"], legal: "", minRating: "", maxFee: "", maxRatio: "", ageMonths: "", sort: "recommended" });
  // Recommended: licence reference first, then rating, then facility count.
  assert.deepEqual(run({}), ["listing-1", "l-2", "l-3"]);
  assert.deepEqual(run({ legal: "referenced" }), ["listing-1"]);
  assert.deepEqual(run({ minRating: "4.5" }), ["listing-1"]);
  assert.deepEqual(run({ province: "Jawa Barat" }), ["l-3"]);
  assert.deepEqual(run({ facilities: "ac" }), ["l-2"]);
  assert.deepEqual(run({ q: "bekasi" }), ["l-3"]);
  assert.deepEqual(run({ sort: "rating" }), ["listing-1", "l-2", "l-3"]);
  assert.deepEqual(run({ sort: "name" }), ["l-2", "l-3", "listing-1"]);
  // Partners always pass the legal filter and rank first.
  assert.deepEqual(filterDirectoryDaycares(parseDirectoryFilters({ legal: "referenced" }), [...listings, partner]).map(d => d.id), ["partner-id", "listing-1"]);
});

test("query string omits defaults and keeps active filters", () => {
  assert.equal(directoryQuery(parseDirectoryFilters()), "");
  assert.equal(directoryQuery(parseDirectoryFilters({ q: "gresik", facilities: "cctv,ac", sort: "rating" })), "q=gresik&facilities=cctv%2Cac&sort=rating");
});

const profile = (overrides = {}) => ({
  data_origin: "synthetic", description: "Profil sintetis untuk pengujian katalog.", monthly_fee_min: 2000000, monthly_fee_max: 2600000,
  daily_fee: 140000, registration_fee: 500000, caregiver_ratio: 4, caregiver_count: 5, daily_capacity: 20,
  age_min_months: 6, age_max_months: 60, opening_time: "07:00:00", closing_time: "17:00:00", operating_days: "Senin–Jumat",
  packages: [{ code: "daily", name: "Harian", unit: "hari", price: 140000 }],
  gallery_images: ["/images/daycare-room.webp", "/images/daycare-garden.webp", "https://evil.example/x.png"], gallery_is_illustration: true,
  ...overrides,
});

test("synthetic profiles are mapped, flagged as estimates and use only local illustrations", () => {
  const listing = toListingDaycare(listingRow({ profile: profile() }), { illustrations: [] });
  assert.equal(listing.monthlyFee, 2000000);
  assert.equal(listing.ratio, 4);
  assert.equal(listing.capacity, 20);
  assert.equal(listing.profile.estimated, true);
  assert.equal(listing.profile.hours, "07.00–17.00");
  assert.equal(listing.description, "Profil sintetis untuk pengujian katalog.");
  assert.deepEqual(listing.gallery, [{ url: "/images/daycare-room.webp", illustration: true }, { url: "/images/daycare-garden.webp", illustration: true }]);
  assert.equal(listing.coverIsIllustration, true);
  // An approved real photo always wins over illustrations.
  const real = toListingDaycare(listingRow({ profile: profile(), cover_image_path: "abc/cover.webp" }), { mediaBaseUrl: "https://abc.supabase.co" });
  assert.equal(real.coverIsIllustration, false);
  assert.equal(real.gallery.length, 1);
  assert.equal(toListingDaycare(listingRow({ profile: profile({ opening_time: "00:00:00", closing_time: "23:59:00" }) })).profile.hours, "24 jam");
});

test("fee, ratio and age filters exclude unknown values and sort ascending", () => {
  const listings = [
    toListingDaycare(listingRow({ id: "cheap", name: "Cheap", profile: profile({ monthly_fee_min: 1400000, caregiver_ratio: 6, age_min_months: 12 }) })),
    toListingDaycare(listingRow({ id: "mid", name: "Mid", profile: profile({ monthly_fee_min: 2900000, caregiver_ratio: 3 }) })),
    toListingDaycare(listingRow({ id: "none", name: "None" })),
  ];
  const run = query => filterDirectoryDaycares(parseDirectoryFilters(query), listings).map(d => d.id);
  assert.deepEqual(run({ maxFee: "1500000" }), ["cheap"]);
  assert.deepEqual(run({ maxFee: "999" }).length, 3, "invalid budget is ignored");
  assert.deepEqual(run({ maxRatio: "4" }), ["mid"]);
  assert.deepEqual(run({ ageMonths: "8" }), ["mid"]);
  assert.deepEqual(run({ ageMonths: "200" }).length, 3, "invalid age is ignored");
  assert.deepEqual(run({ sort: "fee" }), ["cheap", "mid", "none"]);
  assert.deepEqual(run({ sort: "ratio" }), ["mid", "cheap", "none"]);
});

test("comparison rows mark the best values and flag estimated rows", () => {
  const a = toListingDaycare(listingRow({ id: "a", name: "A", public_rating: "4.5", facility_tags: ["cctv"], profile: profile({ monthly_fee_min: 1500000, caregiver_ratio: 5 }) }));
  const b = toListingDaycare(listingRow({ id: "b", name: "B", public_rating: "4.9", facility_tags: ["cctv", "meals"], profile: profile({ monthly_fee_min: 2500000, caregiver_ratio: 3 }) }));
  const c = toListingDaycare(listingRow({ id: "c", name: "C", public_rating: null, facility_tags: [] }));
  const rows = Object.fromEntries(buildComparison([a, b, c]).map(row => [row.key, row]));
  assert.deepEqual(rows.monthly_fee.best, [0]);
  assert.equal(rows.monthly_fee.estimated, true);
  assert.equal(rows.monthly_fee.values[2].display, "Belum tersedia");
  assert.deepEqual(rows.ratio.best, [1]);
  assert.equal(rows.ratio.values[1].display, "1 : 3");
  assert.deepEqual(rows.rating.best, [1]);
  assert.equal(rows.rating.estimated, false);
  assert.deepEqual(rows.facility_count.best, [1]);
  assert.equal(rows["facility:meals"].values[0].display, "Tidak tercatat");
  assert.equal(rows["facility:spa"], undefined, "facilities no daycare has are omitted");
  // Equal values have no single winner.
  assert.deepEqual(buildComparison([a, a]).find(row => row.key === "monthly_fee").best, []);
});
