import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { DAYCARE_DOCUMENT_TYPES, DAYCARE_DOCUMENT_TYPE_VALUES, documentTypeLabel } from "./document-types.js";
import { SAFETY_WEIGHTS, computeSafetyScore } from "./ai/features.js";

const specimenDir = new URL("../docs/06-fitur-ai/spesimen-dokumen/", import.meta.url);

test("document types are unique, match the database key rule, and cover every Safety Score component", () => {
  assert.equal(new Set(DAYCARE_DOCUMENT_TYPE_VALUES).size, DAYCARE_DOCUMENT_TYPE_VALUES.length);
  for (const value of DAYCARE_DOCUMENT_TYPE_VALUES) assert.match(value, /^[a-z][a-z0-9_]{1,39}$/);
  for (const criterion of Object.keys(SAFETY_WEIGHTS)) {
    assert.ok(DAYCARE_DOCUMENT_TYPES.some(type => type.criterion === criterion), `no document type for ${criterion}`);
  }
  assert.equal(documentTypeLabel("safety_sop"), "SOP keselamatan & penjemputan");
  assert.equal(documentTypeLabel("unknown_type"), "unknown_type");
});

// The specimen documents live in docs/06-fitur-ai/spesimen-dokumen.
const hasSpecimens = existsSync(new URL("kunci-jawaban.json", specimenDir));

test("specimen answer key agrees with the server's Safety Score formula and lists real files", { skip: !hasSpecimens && "docs/06-fitur-ai/spesimen-dokumen is not present" }, () => {
  const key = JSON.parse(readFileSync(new URL("kunci-jawaban.json", specimenDir), "utf8"));
  assert.equal(key.fiktif, true);
  assert.equal(key.daycares.length, 3);
  for (const daycare of key.daycares) {
    const result = computeSafetyScore(daycare.expected_criteria);
    assert.equal(result.score, daycare.expected_score, daycare.name);
    assert.deepEqual(result.blockers, daycare.expected_blockers, daycare.name);
    for (const document of daycare.documents) {
      assert.ok(existsSync(new URL(document.file, specimenDir)), `${document.file} is missing`);
      assert.ok(DAYCARE_DOCUMENT_TYPE_VALUES.includes(document.document_type), document.file);
    }
  }
});
