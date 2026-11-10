import test from "node:test";
import assert from "node:assert/strict";
import { ILLUSTRATION_IMAGES, syntheticProfile, toProfileSeedSql } from "./daycare-synthetic.js";

const base = { slug: "rumah-biru-daycare-tebet", name: "Rumah Biru Daycare", province_code: "31", province_name: "DKI Jakarta", city_name: "Jakarta Selatan", district_name: "Tebet", facility_tags: ["cctv", "meals"] };

test("profiles are deterministic per slug and differ between slugs", () => {
  assert.deepEqual(syntheticProfile(base), syntheticProfile({ ...base }));
  assert.notDeepEqual(syntheticProfile(base), syntheticProfile({ ...base, slug: "lain" }));
});

test("generated values stay within realistic, schema-valid ranges", () => {
  const provinces = { "31": [2_500_000, 6_600_000], "32": [1_500_000, 4_600_000], "35": [1_200_000, 4_000_000] };
  for (let i = 0; i < 300; i += 1) {
    const province = ["31", "32", "35"][i % 3];
    const tags = [["infant"], ["preschool", "montessori"], ["extended_hours"], []][i % 4];
    const p = syntheticProfile({ ...base, slug: `daycare-${i}`, province_code: province, facility_tags: tags });
    const [low, high] = provinces[province];
    assert.ok(p.monthly_fee_min >= low && p.monthly_fee_min <= high, `${province} fee ${p.monthly_fee_min}`);
    assert.ok(p.monthly_fee_max >= p.monthly_fee_min);
    assert.equal(p.monthly_fee_min % 50_000, 0);
    assert.ok(p.caregiver_ratio >= 3 && p.caregiver_ratio <= 6);
    if (tags.includes("infant")) assert.ok(p.caregiver_ratio <= 4 && p.age_min_months <= 6);
    if (tags.includes("preschool")) assert.equal(p.age_max_months, 72);
    assert.ok(p.age_max_months > p.age_min_months);
    assert.ok(p.closing_time > p.opening_time);
    assert.equal(p.caregiver_count, Math.ceil(p.daily_capacity / p.caregiver_ratio));
    assert.ok(p.description.length >= 20 && p.description.length <= 1500);
    assert.deepEqual([...p.gallery_images].sort(), [...ILLUSTRATION_IMAGES].sort());
    assert.equal(p.data_origin, "synthetic");
  }
});

test("seed SQL escapes quotes and never overwrites manager data", () => {
  const sql = toProfileSeedSql([{ ...base, name: "D'Kids Daycare" }]);
  assert.match(sql, /D''Kids Daycare/);
  assert.match(sql, /WHERE public\.daycare_listing_profiles\.data_origin = 'synthetic'/);
  assert.match(sql, /JOIN public\.daycare_listings AS l ON l\.slug = v\.slug/);
});
