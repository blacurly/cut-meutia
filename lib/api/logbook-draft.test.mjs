import test from "node:test";
import assert from "node:assert/strict";
import { draftActivity, draftInput, notesToFacts } from "./logbook-draft.js";
import { activityDetails } from "./activities.js";
import { AiError } from "../ai/errors.js";
import { resetRateLimits } from "../ai/rate-limit.js";

const ENROLLMENT = "11111111-1111-4111-8111-111111111111";
const ACTIVITY = "22222222-2222-4222-8222-222222222222";
const CAREGIVER = "33333333-3333-4333-8333-333333333333";

const draft = (overrides = {}) => ({
  id: ACTIVITY, activity_type: "play", status: "draft", version: 2, occurred_at: "2026-11-17T06:30:00+00:00",
  body: "- Menyusun balok jadi menara\n- Bergantian mainan dengan teman", ...overrides,
});

// Supabase double: scripted RPC results and the activity's stored details.
function setup({ activities = [draft()], details = {}, recordError = null } = {}) {
  const calls = [];
  const supabase = {
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === "app_list_daily_activities") return { data: activities, error: null };
      if (name === "app_record_logbook_draft_job") return recordError ? { data: null, error: recordError } : { data: "job-1", error: null };
      return { data: null, error: { message: "unexpected" } };
    },
    from() {
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { details }, error: null }) };
      return query;
    },
  };
  return { context: { supabase, user: { id: CAREGIVER } }, calls };
}

const provider = output => ({
  id: "test",
  async generate() { return { output, meta: { provider: "test", model: "test-model", model_version: "v1", usage: null } }; },
});
const goodOutput = { title: "Bermain balok", body: "Ananda menyusun balok jadi menara.", missing_fields: [], used_fact_indices: [0, 1], requires_caregiver_review: true };

test("notes become one fact per line, or per sentence for a paragraph", () => {
  assert.deepEqual(notesToFacts("- Makan siang habis\n* Minta air\n2) Tidur nyenyak\n\n"), ["Makan siang habis", "Minta air", "Tidur nyenyak"]);
  assert.deepEqual(notesToFacts("Menyusun balok. Bergantian mainan; tertawa!"), ["Menyusun balok.", "Bergantian mainan;", "tertawa!"]);
  assert.deepEqual(notesToFacts("   "), []);
});

test("contract input: meal and sleep activities need their details", () => {
  const input = draftInput(draft());
  assert.equal(input.input_version, 2);
  assert.equal(input.occurred_at, "2026-11-17T06:30:00.000Z");
  assert.equal(input.meal, null);
  assert.throws(() => draftInput(draft({ activity_type: "meal" })), error => error.code === "activity_details_required");
  const meal = { food: "Nasi", portion_consumed: "1/2 porsi", observed_condition: "Makan sendiri" };
  assert.deepEqual(draftInput(draft({ activity_type: "meal" }), { meal }).meal, meal);
  assert.throws(() => draftInput(draft({ body: " " })), error => error.code === "invalid_activity_notes");
});

test("activity details are validated per activity type", () => {
  assert.deepEqual(activityDetails(undefined, "meal"), {});
  assert.deepEqual(activityDetails({ meal: { food: "Nasi" } }, "play"), {});
  assert.throws(() => activityDetails({ meal: { food: "Nasi", portion_consumed: "", observed_condition: "Ceria" } }, "meal"), error => error.code === "invalid_meal_portion");
  assert.throws(() => activityDetails({ sleep: { started_at: "2026-11-17T07:00:00Z", ended_at: "2026-11-17T06:00:00Z" } }, "sleep"), error => error.code === "invalid_sleep_ended_at");
  assert.deepEqual(activityDetails({ sleep: { started_at: "2026-11-17T06:00:00Z", ended_at: "", condition_after: "" } }, "sleep"),
    { sleep: { started_at: "2026-11-17T06:00:00.000Z", ended_at: null, condition_after: null } });
});

test("draft: reads the caller's own draft, runs the model, records the job", async () => {
  resetRateLimits();
  const { context, calls } = setup();
  const result = await draftActivity(context, ENROLLMENT, ACTIVITY, { provider: provider(goodOutput) });
  assert.equal(result.job_id, "job-1");
  assert.equal(result.review_state, "pending");
  assert.equal(result.result.body, goodOutput.body);
  const record = calls.find(call => call.name === "app_record_logbook_draft_job").args;
  assert.equal(record.p_status, "succeeded");
  assert.equal(record.p_input_version, 2);
  assert.equal(record.p_model, "test-model");
  assert.deepEqual(record.p_input_snapshot.observed_facts, ["Menyusun balok jadi menara", "Bergantian mainan dengan teman"]);
});

test("draft: other people's, missing, and sent activities are refused", async () => {
  resetRateLimits();
  await assert.rejects(draftActivity(setup({ activities: [] }).context, ENROLLMENT, ACTIVITY, { provider: provider(goodOutput) }), error => error.status === 404);
  await assert.rejects(draftActivity(setup({ activities: [draft({ status: "sent" })] }).context, ENROLLMENT, ACTIVITY, { provider: provider(goodOutput) }), error => error.status === 409);
  await assert.rejects(draftActivity(setup().context, "x", ACTIVITY, { provider: provider(goodOutput) }), error => error.code === "invalid_enrollment_id");
});

test("draft: works before migration 20261117100000 (job not recorded)", async () => {
  resetRateLimits();
  const { context } = setup({ recordError: { code: "PGRST202", message: "Could not find the function" } });
  const warn = console.warn;
  console.warn = () => {};
  try {
    const result = await draftActivity(context, ENROLLMENT, ACTIVITY, { provider: provider(goodOutput) });
    assert.equal(result.job_id, null);
  } finally { console.warn = warn; }
});

test("draft: model failures are recorded and returned as contract errors", async () => {
  resetRateLimits();
  const { context, calls } = setup();
  const failing = { id: "test", async generate() { throw new AiError("PROVIDER_AUTH"); } };
  await assert.rejects(draftActivity(context, ENROLLMENT, ACTIVITY, { provider: failing }), error => error.code === "PROVIDER_AUTH" && error.status === 502);
  const record = calls.find(call => call.name === "app_record_logbook_draft_job").args;
  assert.equal(record.p_status, "failed");
  assert.equal(record.p_error_code, "PROVIDER_AUTH");
  assert.equal(record.p_output, null);

  const invented = { ...goodOutput, used_fact_indices: [5] };
  await assert.rejects(draftActivity(setup().context, ENROLLMENT, ACTIVITY, { provider: provider(invented) }), error => error.code === "EVIDENCE_MISMATCH");
});

test("draft: at most 10 requests per minute per caregiver", async () => {
  resetRateLimits();
  const { context } = setup();
  for (let i = 0; i < 10; i += 1) await draftActivity(context, ENROLLMENT, ACTIVITY, { provider: provider(goodOutput) });
  await assert.rejects(draftActivity(context, ENROLLMENT, ACTIVITY, { provider: provider(goodOutput) }), error => error.status === 429);
});
