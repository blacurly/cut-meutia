import test from "node:test";
import assert from "node:assert/strict";
import { authHref, normalizeAuthQuery, normalizePhone, validateAuthForm } from "./auth.js";

const valid = { name: "Sustri Simamora", email: "sustri@example.com", phone: "081234567890", password: "Ayomi12345", terms: true };

test("query values stay within the supported roles and languages", () => {
  assert.deepEqual(normalizeAuthQuery({ role: "caregiver", lang: "en" }), { role: "caregiver", language: "en" });
  for (const role of ["__proto__", "constructor", "javascript:alert(1)", ["admin", "parent"], undefined]) {
    assert.deepEqual(normalizeAuthQuery({ role, lang: ["en", "id"] }), { role: "parent", language: "id" });
  }
  assert.equal(authHref("register", "caregiver", "en"), "/daftar?role=caregiver&lang=en");
});

test("registration requires contact details, password criteria, and explicit consent", () => {
  assert.deepEqual(validateAuthForm(valid, { mode: "register" }), {});
  assert.deepEqual(Object.keys(validateAuthForm({}, { mode: "register" })), ["name", "email", "phone", "password", "terms"]);
  for (const password of ["short1", "123456789", "onlyletters", "a1".repeat(65)]) {
    assert.equal(validateAuthForm({ ...valid, password }, { mode: "register" }).password, "password");
  }
  assert.equal(validateAuthForm({ ...valid, terms: "true" }, { mode: "register" }).terms, "terms");
});

test("phone validation accepts common Indonesian formats and rejects foreign or malformed input", () => {
  for (const phone of ["081234567890", "+62 812-3456-7890", "6281234567890", "81234567890"]) {
    assert.equal(normalizePhone(phone), "81234567890");
    assert.equal(validateAuthForm({ ...valid, phone }, { mode: "register" }).phone, undefined);
  }
  for (const phone of ["+1 81234567890", "0812", "812x34567890", "81234567890123"]) {
    assert.equal(validateAuthForm({ ...valid, phone }, { mode: "register" }).phone, "phone");
  }
});

test("caregiver details are required only for caregiver registration", () => {
  const options = { mode: "register", role: "caregiver" };
  assert.deepEqual(validateAuthForm(valid, options), { daycare: "daycare", city: "city" });
  assert.deepEqual(validateAuthForm({ ...valid, daycare: "Kasih Bunda", city: "Gresik" }, options), {});
  assert.deepEqual(validateAuthForm(valid, { mode: "register", role: "parent" }), {});
});

test("public admin registration is blocked and unknown roles are rejected", () => {
  assert.deepEqual(validateAuthForm(valid, { mode: "register", role: "admin" }), { role: "adminRegistration" });
  assert.deepEqual(validateAuthForm(valid, { role: "owner" }), { role: "invalidRole" });
});

test("login does not enforce new registration rules on existing passwords", () => {
  assert.deepEqual(validateAuthForm({ email: "parent@example.com", password: "old" }), {});
  assert.equal(validateAuthForm({ email: "bad email", password: "old" }).email, "email");
  assert.equal(validateAuthForm({ email: "parent@example.com", password: "   " }).password, "passwordRequired");
});
