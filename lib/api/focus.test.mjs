import test from "node:test";
import assert from "node:assert/strict";
import { apiRoute, makeAuthenticate } from "./http.js";
import { parseRender, parseSegment, renderPhoto, segmentPhoto } from "./focus.js";
import { resetRateLimits } from "../ai/rate-limit.js";

const USER = "22222222-2222-4222-8222-222222222222";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const ENV = { CV_API_URL: "https://cv.test/", CV_API_TOKEN: "secret-token" };
const SQUARE = [[10, 10], [60, 10], [60, 80], [10, 80]];
const SEGMENT = {
  image_size: { width: 800, height: 600 },
  people: [{ id: 0, class: "anak", confidence: 0.91, polygon: SQUARE }, { id: 1, class: "dewasa", confidence: 0.7, polygon: SQUARE }],
  suggested_target_id: 0, quality_flags: ["multiple_children", "Bad Flag!"], model_version: "focus-v1", latency_ms: 120,
};
const RENDER = { image_size: { width: 800, height: 600 }, image: { mime_type: "image/jpeg", base64: "/9j/AAAA" },
  other_people_blurred: 1, quality_flags: ["manual_review_required"], model_version: "focus-v1", latency_ms: 300 };

function setup({ role = "caregiver", status = "active", daycares = [], reply = { status: 200, body: SEGMENT }, env = ENV, fetchError = null } = {}) {
  const sent = [];
  const supabase = {
    auth: { async getUser() { return { data: { user: { id: USER } }, error: null }; } },
    from() {
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { role, status }, error: null }) };
      return query;
    },
    async rpc(name) { return { data: name === "app_list_my_daycares" ? daycares : null, error: null }; },
  };
  const fetchImpl = async (url, init) => {
    sent.push({ url, init });
    if (fetchError) throw fetchError;
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { "Content-Type": "application/json" } });
  };
  const authenticate = makeAuthenticate({ cookieClient: () => supabase, bearerClient: () => supabase });
  const call = async (handler, fields = {}, bytes = JPEG) => {
    const form = new FormData();
    if (bytes) form.append("file", new Blob([bytes], { type: "image/jpeg" }), "foto.jpg");
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    const route = apiRoute(authenticate, (context, request) => handler(context, request, { fetchImpl, env }));
    const response = await route(new Request("http://localhost/api/ai/focus", { method: "POST", body: form }), {});
    return { status: response.status, body: await response.json() };
  };
  return { call, sent };
}

test.beforeEach(() => resetRateLimits());

test("segment forwards the photo with the server token and returns sanitized people", async () => {
  const { call, sent } = setup();
  const result = await call(segmentPhoto);
  assert.equal(result.status, 200);
  assert.equal(sent[0].url, "https://cv.test/segment");
  assert.equal(sent[0].init.headers.Authorization, "Bearer secret-token");
  assert.equal(result.body.people.length, 2);
  assert.equal(result.body.suggested_target_id, 0);
  assert.deepEqual(result.body.quality_flags, ["multiple_children"]);
  assert.equal(result.body.ai_generated, true);
  assert.equal(result.body.requires_human_review, true);
  assert.ok(!JSON.stringify(result.body).includes("secret-token"));
});

test("only staff may use it; an active daycare membership also counts", async () => {
  assert.equal((await setup({ role: "parent" }).call(segmentPhoto)).body.code, "staff_role_required");
  assert.equal((await setup({ role: "admin", status: "suspended" }).call(segmentPhoto)).status, 403);
  assert.equal((await setup({ role: "parent", daycares: [{ id: "x", member_role: "caregiver" }] }).call(segmentPhoto)).status, 200);
});

test("photos are checked by their bytes before anything is sent", async () => {
  const { call, sent } = setup();
  assert.equal((await call(segmentPhoto, {}, new Uint8Array([1, 2, 3, 4]))).body.code, "invalid_file");
  assert.equal((await call(segmentPhoto, {}, null)).body.code, "invalid_file");
  assert.equal((await call(segmentPhoto, { note: "x" })).body.code, "invalid_fields");
  assert.equal(sent.length, 0);
});

test("missing configuration and service failures map to AI error codes", async () => {
  assert.equal((await setup({ env: {} }).call(segmentPhoto)).body.code, "MODEL_UNAVAILABLE");
  assert.equal((await setup({ reply: { status: 401, body: {} } }).call(segmentPhoto)).body.code, "PROVIDER_AUTH");
  assert.equal((await setup({ reply: { status: 503, body: {} } }).call(segmentPhoto)).status, 503);
  const timeout = Object.assign(new Error("timeout"), { name: "TimeoutError" });
  assert.equal((await setup({ fetchError: timeout }).call(segmentPhoto)).body.code, "PROVIDER_TIMEOUT");
  const rejected = await setup({ reply: { status: 400, body: { detail: { code: "invalid_image", error: "Berkas bukan gambar." } } } }).call(segmentPhoto);
  assert.deepEqual([rejected.status, rejected.body.code, rejected.body.error], [422, "photo_rejected", "Berkas bukan gambar."]);
});

test("malformed service output is never passed to the browser", () => {
  assert.throws(() => parseSegment({ ...SEGMENT, people: [{ id: 0, class: "orang", confidence: 0.9, polygon: SQUARE }] }), { code: "OUTPUT_INVALID" });
  assert.throws(() => parseSegment({ ...SEGMENT, suggested_target_id: 7 }), { code: "OUTPUT_INVALID" });
  assert.throws(() => parseSegment({ ...SEGMENT, people: [{ id: 0, class: "anak", confidence: 0.9, polygon: [[1, 1]] }] }), { code: "OUTPUT_INVALID" });
  assert.throws(() => parseRender({ ...RENDER, image: { mime_type: "text/html", base64: "PGI+" } }), { code: "OUTPUT_INVALID" });
  assert.throws(() => parseRender({ ...RENDER, image: { mime_type: "image/jpeg", base64: "<script>" } }), { code: "OUTPUT_INVALID" });
});

test("render validates the target polygon and returns the JPEG", async () => {
  const { call, sent } = setup({ reply: { status: 200, body: RENDER } });
  assert.equal((await call(renderPhoto, { target_polygon: "[[1,2]]" })).body.code, "invalid_target_polygon");
  assert.equal((await call(renderPhoto, { target_polygon: "bukan json" })).body.code, "invalid_target_polygon");
  assert.equal((await call(renderPhoto)).body.code, "invalid_target_polygon");
  assert.equal(sent.length, 0);
  const ok = await call(renderPhoto, { target_polygon: JSON.stringify([[10.4, 10.6], [60, 10], [60, 80]]) });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.image.base64, "/9j/AAAA");
  assert.equal(sent[0].url, "https://cv.test/render");
  assert.equal(sent[0].init.body.get("target_polygon"), "[[10,11],[60,10],[60,80]]");
});

test("rate limit: 30 photos per minute per user", async () => {
  const { call } = setup();
  for (let i = 0; i < 30; i += 1) assert.equal((await call(segmentPhoto)).status, 200);
  const limited = await call(segmentPhoto);
  assert.deepEqual([limited.status, limited.body.code], [429, "RATE_LIMITED"]);
});
