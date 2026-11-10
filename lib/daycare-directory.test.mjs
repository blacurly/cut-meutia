import test from "node:test";
import assert from "node:assert/strict";
import {
  directoryQuery, filterDirectoryDaycares, mergeDirectory, parseDirectoryFilters, publicMediaUrl,
  toDirectoryDaycare, toListingDaycare,
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
  const listing = toListingDaycare(listingRow(), { mediaBaseUrl: "https://abc.supabase.co/" });
  assert.equal(listing.kind, "listing");
  assert.equal(listing.rating, 5);
  assert.deepEqual(listing.facilities, ["cctv", "meals"]);
  assert.deepEqual(listing.facilityLabels, ["CCTV", "Makan & snack"]);
  assert.equal(listing.legalReferenceUrl, "https://referensi.data.kemendikdasmen.go.id/pendidikan/npsn/70054305");
  assert.equal(listing.coverImageUrl, null);
  assert.equal(toListingDaycare(listingRow({ legal_status: "bogus" })).legalStatus, "not_available");
  assert.equal(toListingDaycare(listingRow({ public_rating: null })).rating, null);
});

test("cover photos resolve to the public bucket URL with an encoded path", () => {
  assert.equal(publicMediaUrl("abc/cover photo.webp", "https://abc.supabase.co"),
    "https://abc.supabase.co/storage/v1/object/public/daycare-public-media/abc/cover%20photo.webp");
  assert.equal(publicMediaUrl(null, "https://abc.supabase.co"), null);
  assert.equal(publicMediaUrl("a.webp", undefined), null);
});

test("claimed or same-name listings are shown once, as the partner", () => {
  const claimed = toListingDaycare(listingRow({ id: "l-2", name: "Other", claimed_daycare_id: "partner-id" }));
  const sameName = toListingDaycare(listingRow({ id: "l-3", name: "SMART SHIN HOUSE – Daycare" }));
  const other = toListingDaycare(listingRow());
  assert.deepEqual(mergeDirectory([partner], [claimed, sameName, other]).map(d => d.id), ["partner-id", "listing-1"]);
});

test("filters validate input and combine legal, rating, region and facility rules", () => {
  const listings = [
    toListingDaycare(listingRow()),
    toListingDaycare(listingRow({ id: "l-2", name: "A Daycare", public_rating: "4.2", legal_status: "not_available", legal_reference: null, npsn: null, facility_tags: ["ac"] })),
    toListingDaycare(listingRow({ id: "l-3", name: "B Daycare", public_rating: null, legal_status: "in_review", legal_reference: null, npsn: null, city_name: "Kota Bekasi", province_name: "Jawa Barat" })),
  ];
  const run = query => filterDirectoryDaycares(parseDirectoryFilters(query), listings).map(d => d.id);
  assert.deepEqual(parseDirectoryFilters({ facilities: "cctv,hack", minRating: "3", legal: "x", sort: "price" }),
    { q: "", province: "", city: "", district: "", facilities: ["cctv"], legal: "", minRating: "", sort: "recommended" });
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
