import test from "node:test";
import assert from "node:assert/strict";
import { toDirectoryDaycare, filterDirectoryDaycares, parseDirectoryFilters } from "./daycare-directory.js";

test("directory filters use actual fields and ignore unsupported old query parameters", () => {
  const daycare = toDirectoryDaycare({ id: "live-id", name: "Smart Shin House - Daycare", city_code: "Surabaya", district_code: "Sukolilo", province_code: "Jawa Timur", facilities: { features: [{ key: "learning", label: "Learning" }] }, daily_capacity: 18, status: "active", main_manager_id: "private-id" });
  assert.equal(filterDirectoryDaycares(parseDirectoryFilters(), [daycare]).length, 1);
  assert.equal(filterDirectoryDaycares(parseDirectoryFilters({ q: "shin" }), [daycare]).length, 1);
  assert.equal(filterDirectoryDaycares(parseDirectoryFilters({ q: "missing" }), [daycare]).length, 0);
  for (const filters of [{ score: "80" }, { verified: "true" }, { price: "1000000" }]) {
    assert.equal(filterDirectoryDaycares(parseDirectoryFilters(filters), [daycare]).length, 1);
  }
  assert.equal(filterDirectoryDaycares(parseDirectoryFilters({ facilities: "learning", district: "Sukolilo" }), [daycare]).length, 1);
  assert.equal(filterDirectoryDaycares(parseDirectoryFilters({ province: "Jakarta" }), [daycare]).length, 0);
  assert.equal(filterDirectoryDaycares(parseDirectoryFilters({ facilities: "cctv" }), [daycare]).length, 0);
  for (const field of ["price", "score", "verified", "rating", "ratio", "distance"]) assert.equal(Object.hasOwn(daycare, field), false);
  assert.equal(daycare.capacity, 18);
  assert.equal(daycare.status, "active");
  assert.equal(Object.hasOwn(daycare, "main_manager_id"), false);
  assert.deepEqual(daycare.facilities, ["learning"]);
});
