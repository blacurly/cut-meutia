import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getSafetyReview, saveSafetyScore, withdrawSafetyScore } from "./safety-score.js";
import { DAYCARE_DOCUMENT_TYPES } from "../document-types.js";
import { scoreFromCriteria } from "../safety-score.js";

const DAYCARE = "11111111-1111-4111-8111-111111111111";
const DOC = "22222222-2222-4222-8222-222222222222";
const route = (id = DAYCARE) => ({ params: Promise.resolve({ id }) });
const request = (body, method = "POST") => new Request("https://ayomi.test/api", {
  method, headers: { "content-type": "application/json", "x-request-id": "req-1" }, body: JSON.stringify(body),
});
function context(result = { ok: true }) {
  const calls = [];
  return { calls, supabase: { async rpc(name, args) { calls.push({ name, args }); return { data: result, error: null }; } } };
}
const criteria = (overrides = {}) => ["legal", "sop", "staff", "facility"].map(id => ({
  id, status: "pass", reason: "Bukti lengkap dan berlaku.", document_ids: [DOC], ...overrides[id],
}));
const rejects = (promise, code, status) => assert.rejects(promise, error => error.code === code && error.status === status);

test("review and save call the Admin RPCs with validated values", async () => {
  const ctx = context();
  await getSafetyReview(ctx, null, route());
  await saveSafetyScore(ctx, request({ criteria: criteria(), publish: true }), route());
  assert.deepEqual(ctx.calls.map(call => call.name), ["app_admin_get_safety_review", "app_admin_save_safety_score"]);
  const args = ctx.calls[1].args;
  assert.equal(args.p_daycare_id, DAYCARE);
  assert.equal(args.p_publish, true);
  assert.equal(args.p_criteria.length, 4);
  assert.deepEqual(args.p_criteria[0], { id: "legal", status: "pass", reason: "Bukti lengkap dan berlaku.", document_ids: [DOC] });
});

test("bad input never reaches the database", async () => {
  const ctx = context();
  await rejects(getSafetyReview(ctx, null, route("bukan-uuid")), "invalid_id", 400);
  await rejects(saveSafetyScore(ctx, request({ criteria: criteria().slice(0, 3), publish: false }), route()), "invalid_criteria", 400);
  const twice = criteria(); twice[1] = { ...twice[0] };
  await rejects(saveSafetyScore(ctx, request({ criteria: twice, publish: false }), route()), "invalid_criteria", 400);
  await rejects(saveSafetyScore(ctx, request({ criteria: criteria({ sop: { reason: "ok" } }), publish: false }), route()), "invalid_reason", 400);
  await rejects(saveSafetyScore(ctx, request({ criteria: criteria({ staff: { document_ids: [] } }), publish: false }), route()), "invalid_safety_evidence", 400);
  await rejects(saveSafetyScore(ctx, request({ criteria: criteria({ staff: { document_ids: ["x"] } }), publish: false }), route()), "invalid_document_ids", 400);
  await rejects(saveSafetyScore(ctx, request({ criteria: criteria({ facility: { status: "unknown" } }), publish: false }), route()), "safety_score_incomplete", 400);
  await rejects(saveSafetyScore(ctx, request({ criteria: criteria(), publish: "ya" }), route()), "invalid_publish", 400);
  await rejects(saveSafetyScore(ctx, request({ criteria: criteria(), publish: true, score: 100 }), route()), "invalid_fields", 400);
  assert.equal(ctx.calls.length, 0);
});

test("a failed legal check can be saved as a draft but not published", async () => {
  const failed = criteria({ legal: { status: "fail", reason: "Izin operasional kedaluwarsa.", document_ids: [] } });
  await rejects(saveSafetyScore(context(), request({ criteria: failed, publish: true }), route()), "safety_score_publication_blocked", 409);
  const ctx = context();
  await saveSafetyScore(ctx, request({ criteria: failed, publish: false }), route());
  assert.equal(ctx.calls[0].args.p_publish, false);
  assert.deepEqual(scoreFromCriteria(failed), { score: 60, coverage: 1, blockers: ["LEGAL_NOT_PASSED"] });
});

test("withdraw needs a reason", async () => {
  await rejects(withdrawSafetyScore(context(), request({ reason: "x" }, "DELETE"), route()), "invalid_reason", 400);
  const ctx = context();
  await withdrawSafetyScore(ctx, request({ reason: "Bukti fasilitas dipersoalkan orang tua." }, "DELETE"), route());
  assert.equal(ctx.calls[0].name, "app_admin_withdraw_safety_score");
});

test("the SQL document-to-component map matches lib/document-types.js", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261118100000_safety_score_admin_review.sql", import.meta.url), "utf8");
  const mapped = Object.fromEntries([...sql.matchAll(/WHEN '([a-z_]+)' THEN '(legal|sop|staff|facility)'/g)].map(([, type, criterion]) => [type, criterion]));
  const expected = Object.fromEntries(DAYCARE_DOCUMENT_TYPES.filter(type => type.criterion).map(type => [type.value, type.criterion]));
  assert.deepEqual(mapped, expected);
});
