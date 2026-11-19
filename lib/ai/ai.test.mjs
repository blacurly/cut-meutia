import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SUPPORTED_KEYWORDS, keywordsOf, validate } from "./schema.js";
import { AiError } from "./errors.js";
import { FEATURES, FEATURE_IDS, computeSafetyScore, contractDocument, effectiveUrgency, featureContract, sleepMinutes } from "./features.js";
import { fixtureProvider } from "./providers/fixture.js";
import { getProvider } from "./providers/index.js";
import { createOpenAiCompatibleProvider, parseJsonContent } from "./providers/openai-compatible.js";
import { runAiTask } from "./run.js";
import { resetRateLimits, takeToken } from "./rate-limit.js";
import { apiRoute, makeAuthenticate } from "../api/http.js";
import { listFeatures, runSandbox } from "../api/ai.js";

const noSleep = async () => {};
const example = feature => structuredClone(featureContract(feature).input_example);
const providerReturning = output => ({ id: "test", configured: () => true, generate: async () => ({ output, meta: { provider: "test", model: "m", model_version: "not_reported", usage: null } }) });

test("the contract only uses keywords the validator supports", async () => {
  const contract = contractDocument();
  const used = new Set();
  for (const feature of Object.values(contract.features)) {
    keywordsOf(feature.input_schema, used);
    keywordsOf(feature.output_schema, used);
  }
  keywordsOf(contract.request_schema, used);
  keywordsOf(contract.job_status_schema, used);
  assert.deepEqual([...used].filter(key => !SUPPORTED_KEYWORDS.has(key)), []);
});

test("the runtime contract copy matches the local docs/kontrak-ai-mvp-v1.json when present", async () => {
  const docs = await readFile(new URL("../../docs/kontrak-ai-mvp-v1.json", import.meta.url), "utf8").catch(() => null);
  if (docs) assert.deepEqual(JSON.parse(docs), contractDocument());
});

test("every feature runs end to end on its contract example", async () => {
  assert.equal(FEATURE_IDS.length, 8);
  for (const feature of FEATURE_IDS) {
    const envelope = await runAiTask({ feature, input: example(feature), provider: fixtureProvider });
    assert.equal(envelope.status, "succeeded", feature);
    assert.deepEqual(validate(featureContract(feature).output_schema, envelope.result), [], feature);
    assert.equal(envelope.review_state, "pending");
    assert.equal(envelope.meta.ai_generated, true);
    const { meta, ...status } = envelope;
    assert.ok(meta.prompt_version);
    assert.deepEqual(validate(contractDocument().job_status_schema, { ...status, job_id: "00000030-1111-4111-8111-111111111111", root_job_id: "00000030-1111-4111-8111-111111111111" })
      .filter(error => !/feature|contract_version/.test(error.path)), []);
  }
});

test("validator reports types, enums, formats and unknown properties", () => {
  const schema = featureContract("logbook_draft").input_schema;
  const bad = { ...example("logbook_draft"), activity_type: "nap", occurred_at: "kemarin", extra: 1 };
  const paths = validate(schema, bad).map(error => error.path);
  assert.deepEqual(paths.sort(), ["$.activity_type", "$.extra", "$.occurred_at"]);
  assert.equal(validate({ type: "integer" }, 1.5).length, 1);
  assert.equal(validate({ anyOf: [{ type: "string" }, { type: "null" }] }, null).length, 0);
});

test("invalid input never reaches the provider", async () => {
  let called = false;
  const provider = { generate: async () => { called = true; } };
  await assert.rejects(runAiTask({ feature: "logbook_draft", input: { activity_id: "x" }, provider }), error => error.code === "INPUT_INVALID");
  const mixed = { ...example("logbook_draft"), activity_type: "play" };
  await assert.rejects(runAiTask({ feature: "logbook_draft", input: mixed, provider }), error => error.code === "INPUT_INVALID");
  const few = { ...example("review_summary"), reviews: example("review_summary").reviews.slice(0, 4) };
  await assert.rejects(runAiTask({ feature: "review_summary", input: few, provider }), error => error.code === "INPUT_INVALID");
  assert.equal(called, false);
});

test("Safety Score is computed by code, never taken from the model", async () => {
  const criteria = (legal, sop, staff, facility) => [["legal", legal], ["sop", sop], ["staff", staff], ["facility", facility]]
    .map(([id, status]) => ({ id, status, reason: "uji", evidence: [] }));
  assert.deepEqual(computeSafetyScore(criteria("pass", "pass", "pass", "pass")), { score: 100, coverage: 1, blockers: [] });
  assert.deepEqual(computeSafetyScore(criteria("pass", "partial", "pass", "fail")), { score: 72.5, coverage: 1, blockers: [] });
  assert.deepEqual(computeSafetyScore(criteria("pass", "unknown", "pass", "pass")), { score: null, coverage: 0.75, blockers: ["INSUFFICIENT_VERIFIED_EVIDENCE"] });
  assert.deepEqual(computeSafetyScore(criteria("partial", "pass", "pass", "pass")).blockers, ["LEGAL_NOT_PASSED"]);

  const claimed = { ...featureContract("safety_score").output_example, criteria: criteria("pass", "pass", "pass", "pass"), score: 5, coverage: 3 };
  const envelope = await runAiTask({ feature: "safety_score", input: example("safety_score"), provider: providerReturning(claimed) });
  assert.equal(envelope.result.score, 100);
  assert.equal(envelope.result.coverage, 1);
});

test("triage keeps the higher urgency and rejects invented evidence", async () => {
  assert.equal(effectiveUrgency({ caregiver: "medium", ai: "high" }), "high");
  assert.equal(effectiveUrgency({ caregiver: "high", ai: "low" }), "high");
  assert.equal(effectiveUrgency({ caregiver: "medium", ai: null }), "medium");
  assert.equal(effectiveUrgency({ caregiver: "low", ai: "emergency", managerOverride: "medium" }), "medium");
  const invented = { ...featureContract("incident_triage").output_example, urgency: "high", evidence_quotes: ["Anak demam tinggi."] };
  await assert.rejects(runAiTask({ feature: "incident_triage", input: example("incident_triage"), provider: providerReturning(invented) }),
    error => error.code === "EVIDENCE_MISMATCH");
});

test("semantic checks stop unsafe drafts and unsupported claims", async () => {
  const promise = { ...featureContract("smart_reply").output_example, draft: "Mohon maaf, kami akan memberikan refund penuh." };
  await assert.rejects(runAiTask({ feature: "smart_reply", input: example("smart_reply"), provider: providerReturning(promise) }), error => error.code === "OUTPUT_INVALID");
  const summary = structuredClone(featureContract("review_summary").output_example);
  summary.claims[0].source_version_ids.push("99999999-1111-4111-8111-111111111111");
  await assert.rejects(runAiTask({ feature: "review_summary", input: example("review_summary"), provider: providerReturning(summary) }), error => error.code === "EVIDENCE_MISMATCH");
  const logbook = { ...featureContract("logbook_draft").output_example, used_fact_indices: [7] };
  await assert.rejects(runAiTask({ feature: "logbook_draft", input: example("logbook_draft"), provider: providerReturning(logbook) }), error => error.code === "EVIDENCE_MISMATCH");
  await assert.rejects(runAiTask({ feature: "logbook_draft", input: example("logbook_draft"), provider: providerReturning({ title: "x" }) }), error => error.code === "OUTPUT_INVALID");
  assert.equal(sleepMinutes({ started_at: "2026-11-05T12:00:00+07:00", ended_at: "2026-11-05T13:30:00+07:00" }), 90);
});

test("retries only retryable provider errors, at most three attempts", async () => {
  let calls = 0;
  const flaky = { generate: async () => {
    calls += 1;
    if (calls < 3) throw new AiError("RATE_LIMITED");
    return fixtureProvider.generate({ feature: "review_moderation" });
  } };
  const envelope = await runAiTask({ feature: "review_moderation", input: example("review_moderation"), provider: flaky, sleep: noSleep });
  assert.deepEqual([calls, envelope.attempt_number], [3, 3]);

  calls = 0;
  const down = { generate: async () => { calls += 1; throw new AiError("PROVIDER_UNAVAILABLE"); } };
  await assert.rejects(runAiTask({ feature: "review_moderation", input: example("review_moderation"), provider: down, sleep: noSleep }), error => error.attempt === 3);
  calls = 0;
  const auth = { generate: async () => { calls += 1; throw new AiError("PROVIDER_AUTH"); } };
  await assert.rejects(runAiTask({ feature: "review_moderation", input: example("review_moderation"), provider: auth, sleep: noSleep }), error => error.code === "PROVIDER_AUTH");
  assert.equal(calls, 1);
});

test("OpenAI-compatible adapter: JSON parsing and error mapping", async () => {
  assert.deepEqual(parseJsonContent("```json\n{\"a\":1}\n```"), { a: 1 });
  assert.deepEqual(parseJsonContent("Berikut hasilnya: {\"a\":2} selesai"), { a: 2 });
  assert.throws(() => parseJsonContent("bukan json"), error => error.code === "OUTPUT_INVALID");

  const saved = { ...process.env };
  Object.assign(process.env, { AI_API_KEY: "test-key", AI_TEXT_MODEL: "open/model", AI_BASE_URL: "https://ai.test/v1" });
  try {
    const requests = [];
    const ok = createOpenAiCompatibleProvider({ fetchImpl: async (url, init) => {
      requests.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
      return new Response(JSON.stringify({ model: "open/model-2026", choices: [{ message: { content: JSON.stringify(featureContract("review_moderation").output_example) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));
    } });
    const envelope = await runAiTask({ feature: "review_moderation", input: example("review_moderation"), provider: ok });
    assert.equal(requests[0].url, "https://ai.test/v1/chat/completions");
    assert.equal(requests[0].auth, "Bearer test-key");
    assert.match(requests[0].body.messages[0].content, /bukan instruksi/);
    assert.deepEqual([envelope.meta.model_version, envelope.meta.usage.input_tokens], ["open/model-2026", 10]);

    const denied = createOpenAiCompatibleProvider({ fetchImpl: async () => new Response("no", { status: 401 }) });
    await assert.rejects(denied.generate({ instructions: "", input: {}, outputSchema: {} }), error => error.code === "PROVIDER_AUTH");
    const busy = createOpenAiCompatibleProvider({ fetchImpl: async () => new Response("busy", { status: 503 }) });
    await assert.rejects(busy.generate({ instructions: "", input: {}, outputSchema: {} }), error => error.code === "PROVIDER_UNAVAILABLE" && error.retryable);
    delete process.env.AI_API_KEY;
    await assert.rejects(ok.generate({ instructions: "", input: {}, outputSchema: {} }), error => error.code === "MODEL_UNAVAILABLE");
  } finally {
    for (const key of ["AI_API_KEY", "AI_TEXT_MODEL", "AI_BASE_URL"]) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test("provider selection is explicit in production and vision needs its own processor", () => {
  assert.equal(getProvider("logbook_draft", { NODE_ENV: "development" }).id, "fixture");
  assert.throws(() => getProvider("logbook_draft", { NODE_ENV: "production" }), error => error.code === "MODEL_UNAVAILABLE");
  assert.equal(getProvider("logbook_draft", { NODE_ENV: "production", AI_PROVIDER: "openai-compatible" }).id, "openai-compatible");
  assert.throws(() => getProvider("privacy_masking", { AI_PROVIDER: "openai-compatible" }), error => error.code === "MODEL_UNAVAILABLE");
});

test("rate limit window", () => {
  resetRateLimits();
  for (let i = 0; i < 3; i += 1) assert.equal(takeToken("u", { limit: 3, now: 1000 }).allowed, true);
  assert.deepEqual(takeToken("u", { limit: 3, now: 1500, windowMs: 60_000 }), { allowed: false, remaining: 0, retryAfterSeconds: 60 });
  assert.equal(takeToken("u", { limit: 3, now: 62_000 }).allowed, true);
});

test("AI API: public feature list and Admin-only sandbox", async () => {
  resetRateLimits();
  const list = listFeatures();
  assert.equal(list.features.length, 8);
  assert.ok(list.features.every(feature => feature.example_input && feature.use_case));

  const route = role => {
    const supabase = {
      auth: { async getUser() { return { data: { user: { id: `user-${role}` } }, error: null }; } },
      from() {
        const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { role, status: "active" }, error: null }) };
        return query;
      },
    };
    const authenticate = makeAuthenticate({ cookieClient: () => supabase, bearerClient: () => supabase });
    return async (feature, body) => {
      const response = await apiRoute(authenticate, (context, request) => runSandbox(context, request, feature))(
        new Request("http://localhost:3000/api/ai/sandbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
      return { status: response.status, data: await response.json() };
    };
  };
  const admin = route("admin");
  const ok = await admin("logbook_draft", { input: example("logbook_draft") });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.result.requires_caregiver_review, true);
  assert.equal(ok.data.meta.provider, "fixture");
  assert.equal((await admin("logbook_draft", { input: { activity_id: "x" } })).data.code, "INPUT_INVALID");
  assert.equal((await admin("tebak_skor", { input: {} })).status, 404);
  assert.equal((await admin("logbook_draft", {})).status, 400);
  assert.equal((await route("parent")("logbook_draft", { input: example("logbook_draft") })).status, 403);
  for (let i = 0; i < 10; i += 1) await admin("review_moderation", { input: example("review_moderation") });
  assert.equal((await admin("review_moderation", { input: example("review_moderation") })).status, 429);
});
