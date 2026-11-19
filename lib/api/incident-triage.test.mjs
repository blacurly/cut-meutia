import test from "node:test";
import assert from "node:assert/strict";
import { TRIAGE_SOP_REFERENCES, overrideIncidentUrgency, retriageIncident, runIncidentTriage, triageInput, triageNewIncident } from "./incident-triage.js";
import { getProvider } from "../ai/providers/index.js";
import { createTriageApiProvider } from "../ai/providers/triage-api.js";
import { resetRateLimits } from "../ai/rate-limit.js";

const INCIDENT = "44444444-4444-4444-8444-444444444444";
const stored = {
  incident_id: INCIDENT, version: 1, occurred_at: "2026-11-19T02:00:00+00:00", age_months: 32,
  description: "Anak tersedak anggur saat snack. Wajahnya membiru dan tidak bisa menangis.",
  first_aid: "Tepukan punggung dilakukan.", caregiver_urgency: "medium", effective_urgency: "medium", urgency_source: "caregiver",
};
const emergency = {
  urgency: "emergency", reason: "Usulan prioritas darurat menurut rubrik.", evidence_quotes: ["Wajahnya membiru dan tidak bisa menangis."],
  sop_refs: ["triage-emergency@draf-1", "incident-workflow@1"], missing_information: [],
  operational_actions: ["notify_manager", "follow_approved_sop"], needs_human_review: true,
};
const ENV = { TRIAGE_API_URL: "https://triage.test/", TRIAGE_API_TOKEN: "rahasia" };

function setup({ incident = stored, recordError = null, missing = false } = {}) {
  const calls = [];
  const supabase = {
    async rpc(name, args) {
      calls.push({ name, args });
      if (missing) return { data: null, error: { code: "PGRST202", message: "not found" } };
      if (name === "app_get_incident_for_triage") return { data: incident, error: null };
      if (name === "app_record_incident_triage") {
        if (recordError) return { data: null, error: { message: recordError } };
        const raised = args.p_status === "succeeded" && args.p_output.urgency === "emergency";
        return { data: { job_id: "job-1", raised, effective_urgency: raised ? "emergency" : "medium", urgency_source: raised ? "ai_max" : "caregiver" }, error: null };
      }
      if (name === "app_override_incident_urgency") return { data: { id: args.p_incident_id, urgency: args.p_urgency, urgency_source: "manager_override" }, error: null };
      return { data: null, error: { message: "unexpected" } };
    },
  };
  return { context: { supabase, user: { id: "manager-1" } }, calls };
}

const serviceFetch = (result = emergency, { status = 200, engine = "rules" } = {}) => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify(status === 200 ? {
      result, meta: { engine, model_version: engine === "rules" ? "triage-rules-draf-1-v1" : "triage-indobert-v1-20261120", rubric_version: "draf-1", base_model: "indobenchmark/indobert-base-p1", probabilities: null, matched_rules: ["choking_airway"] },
    } : { detail: { code: "x" } }), { status, headers: { "Content-Type": "application/json" } });
  };
  return { fetchImpl, requests };
};

test("input: report text, age, first aid, and the rubric as SOP references; nothing else", () => {
  const input = triageInput(stored);
  assert.equal(input.incident_id, INCIDENT);
  assert.equal(input.age_months, 32);
  assert.equal(input.first_aid_already_done, "Tepukan punggung dilakukan.");
  assert.deepEqual(input.observed_facts, []);
  assert.deepEqual(input.sop_references.map(s => s.id), ["triage-emergency", "triage-high", "triage-medium", "triage-low", "incident-workflow"]);
  assert.ok(TRIAGE_SOP_REFERENCES.every(s => s.text.length > 50));
  assert.equal(triageInput({ ...stored, age_months: null }).age_months, null);
});

test("triage service: posts the contract input with the token, maps the engine to model names", async () => {
  const { fetchImpl, requests } = serviceFetch();
  const provider = createTriageApiProvider({ env: ENV, fetchImpl });
  const out = await provider.generate({ feature: "incident_triage", input: triageInput(stored) });
  assert.equal(requests[0].url, "https://triage.test/triage");
  assert.equal(requests[0].init.headers.Authorization, "Bearer rahasia");
  assert.equal(requests[0].body.description, stored.description);
  assert.equal(out.meta.model, "rubric-rules");
  const model = await createTriageApiProvider({ env: ENV, fetchImpl: serviceFetch(emergency, { engine: "model" }).fetchImpl })
    .generate({ feature: "incident_triage", input: triageInput(stored) });
  assert.equal(model.meta.model, "indobenchmark/indobert-base-p1");
  await assert.rejects(createTriageApiProvider({ env: ENV, fetchImpl: serviceFetch(emergency, { status: 401 }).fetchImpl })
    .generate({ feature: "incident_triage", input: {} }), error => error.code === "PROVIDER_AUTH");
});

test("incident triage never goes to a general language model", () => {
  assert.equal(getProvider("incident_triage", ENV).id, "triage-api");
  assert.equal(getProvider("incident_triage", { NODE_ENV: "development" }).id, "fixture");
  assert.throws(() => getProvider("incident_triage", { AI_PROVIDER: "openai-compatible", AI_API_KEY: "x" }), error => error.code === "MODEL_UNAVAILABLE");
});

test("success: recorded with the service's model and the database decides the raise", async () => {
  const { context, calls } = setup();
  const provider = createTriageApiProvider({ env: ENV, fetchImpl: serviceFetch().fetchImpl });
  const outcome = await runIncidentTriage(context, INCIDENT, { provider });
  assert.equal(outcome.status, "succeeded");
  assert.equal(outcome.raised, true);
  assert.equal(outcome.effective_urgency, "emergency");
  const record = calls.find(call => call.name === "app_record_incident_triage").args;
  assert.equal(record.p_status, "succeeded");
  assert.equal(record.p_model, "rubric-rules");
  assert.equal(record.p_model_version, "triage-rules-draf-1-v1");
  assert.equal(record.p_input_version, 1);
  assert.ok(record.p_idempotency_key.startsWith(`incident_triage:${INCIDENT}:`));
  assert.ok(record.p_input_snapshot.sop_references.every(ref => !("text" in ref)), "snapshot stores SOP ids, not the full rubric");
});

test("a quote that is not in the report is rejected before it is recorded as success", async () => {
  const { context, calls } = setup();
  const invented = { ...emergency, evidence_quotes: ["Anak pingsan di halaman."] };
  const provider = createTriageApiProvider({ env: ENV, fetchImpl: serviceFetch(invented).fetchImpl });
  await assert.rejects(runIncidentTriage(context, INCIDENT, { provider }), error => error.code === "EVIDENCE_MISMATCH");
  const record = calls.find(call => call.name === "app_record_incident_triage").args;
  assert.equal(record.p_status, "failed");
  assert.equal(record.p_error_code, "EVIDENCE_MISMATCH");
});

test("after(): failures and a missing service never throw; the report keeps the reporter's urgency", async () => {
  const quiet = console.error; const warn = console.warn;
  console.error = () => {}; console.warn = () => {};
  try {
    const skipped = await triageNewIncident(setup().context, INCIDENT, {
      provider: undefined, run: async () => { throw new Error("tidak boleh dipanggil"); },
    }).catch(error => error);
    assert.ok(["skipped", "succeeded", "failed"].includes(skipped.status));
    const down = createTriageApiProvider({ env: ENV, fetchImpl: async () => { throw new TypeError("fetch failed"); } });
    const failed = await triageNewIncident(setup().context, INCIDENT, { provider: down, run: async ({ provider }) => provider.generate({ feature: "incident_triage", input: {} }) });
    assert.deepEqual(failed, { status: "failed", code: "PROVIDER_UNAVAILABLE" });
    const notInstalled = await triageNewIncident(setup({ missing: true }).context, INCIDENT, { provider: down });
    assert.equal(notInstalled.code, "triage_not_installed");
  } finally {
    console.error = quiet; console.warn = warn;
  }
});

test("re-run is rate limited and reports an unconfigured service", async () => {
  resetRateLimits();
  const { context } = setup();
  const provider = createTriageApiProvider({ env: ENV, fetchImpl: serviceFetch().fetchImpl });
  for (let i = 0; i < 10; i += 1) await retriageIncident(context, INCIDENT, { provider });
  await assert.rejects(retriageIncident(context, INCIDENT, { provider }), error => error.status === 429);
  resetRateLimits();
});

test("override: urgency and a reason of at least 10 characters", async () => {
  const { context, calls } = setup();
  const request = body => new Request("http://localhost/api/incidents/x/urgency", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await overrideIncidentUrgency(context, request({ urgency: "high", reason: "Sudah bernapas normal, dipantau ketat." }), INCIDENT);
  assert.equal(result.urgency_source, "manager_override");
  assert.equal(calls.at(-1).args.p_urgency, "high");
  await assert.rejects(overrideIncidentUrgency(context, request({ urgency: "high", reason: "singkat" }), INCIDENT), error => error.status === 400);
  await assert.rejects(overrideIncidentUrgency(context, request({ urgency: "kritis", reason: "alasan yang cukup panjang" }), INCIDENT), error => error.status === 400);
});
