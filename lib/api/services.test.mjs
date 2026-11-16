import test from "node:test";
import assert from "node:assert/strict";
import { apiRoute, makeAuthenticate, makeOptionalAuthenticate } from "./http.js";
import { archiveChild, listChildren, updateChild } from "./children.js";
import { cancelEnrollment, createEnrollment, createPayment, listEnrollments, updateEnrollment } from "./enrollments.js";
import { acknowledgeActivity, addActivityComment, deleteActivityComment, deleteDraftActivity, listActivityComments, saveActivity, setActivityLove } from "./activities.js";
import { createIncident, updateIncidentStatus } from "./incidents.js";
import { listPublicReviews, moderate, submitReview } from "./reviews.js";
import { listNotifications, recordPaymentResult } from "./account.js";
import { ENROLLMENT_CONSENT } from "../enrollment-consent.js";

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const PARENT = "33333333-3333-4333-8333-333333333333";
// "Tomorrow" in Asia/Jakarta, like the server (a UTC date fails between 00:00 and 07:00 WIB).
const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(Date.now() + 86_400_000));

// Supabase double: records RPC calls and returns scripted results.
function setup({ rpcResults = {}, rpcError = null, user = { id: PARENT }, role = "parent" } = {}) {
  const calls = [];
  const supabase = {
    auth: { async getUser() { return user ? { data: { user }, error: null } : { data: { user: null }, error: new Error("missing") }; } },
    async rpc(name, args) {
      calls.push({ name, args });
      if (rpcError) return { data: null, error: { message: rpcError } };
      const result = rpcResults[name];
      return { data: typeof result === "function" ? result(args) : result ?? null, error: null };
    },
    from(table) {
      const rows = {
        users: [{ id: PARENT, role, status: "active", full_name: "Bunda", phone: null, deleted_at: null }],
        children: [{ child_id: ID, parent_id: PARENT, full_name: "Anak", birth_date: "2024-01-01", gender: null, general_notes: null, status: "active", created_at: "2026-01-01", updated_at: "2026-01-01", deleted_at: null }],
      }[table];
      const filters = [];
      const query = {
        select() { return query; }, order() { return query; },
        eq(key, value) { filters.push(row => row[key] === value); return query; },
        is(key, value) { filters.push(row => (row[key] ?? null) === value); return query; },
        maybeSingle() { query.single = true; return query; },
        then(resolve) {
          const data = rows.filter(row => filters.every(match => match(row)));
          return Promise.resolve({ data: query.single ? data[0] ?? null : data, error: null }).then(resolve);
        },
      };
      return query;
    },
  };
  const clients = { cookieClient: () => supabase, bearerClient: () => supabase };
  const call = async (handler, { method = "GET", body, path = "/api/test", headers = {}, status = 200, optional = false } = {}) => {
    const request = new Request(`http://localhost:3000${path}`, {
      method,
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const authenticate = optional ? makeOptionalAuthenticate(clients) : makeAuthenticate(clients);
    const response = await apiRoute(authenticate, handler, status)(request);
    return { status: response.status, data: await response.json() };
  };
  return { call, calls };
}

test("protected endpoints return 401 without a session and never reach the database", async () => {
  const { call, calls } = setup({ user: null });
  for (const handler of [listChildren, createEnrollment, c => listNotifications(c, new URLSearchParams())]) {
    assert.equal((await call(handler, { method: "POST", body: {} })).status, 401);
  }
  assert.deepEqual(calls, []);
});

test("public review list works for visitors", async () => {
  const { call, calls } = setup({ user: null, rpcResults: { app_list_public_reviews: { count: 0, items: [] } } });
  const { status, data } = await call(c => listPublicReviews(c, ID), { optional: true });
  assert.equal(status, 200);
  assert.deepEqual(data, { count: 0, items: [] });
  assert.deepEqual(calls[0], { name: "app_list_public_reviews", args: { p_daycare_id: ID } });
  assert.equal((await call(c => listPublicReviews(c, "not-a-uuid"), { optional: true })).status, 400);
});

test("child update validates fields and archive maps history conflicts to 409", async () => {
  const { call, calls } = setup({ rpcResults: { app_parent_update_child: null } });
  for (const body of [
    { full_name: "A", birth_date: "2024-01-01" },
    { full_name: "Anak", birth_date: "2024-02-30" },
    { full_name: "Anak", birth_date: tomorrow },
    { full_name: "Anak", birth_date: "2024-01-01", gender: "x" },
    { full_name: "Anak", birth_date: "2024-01-01", parent_id: ID2 },
  ]) assert.equal((await call((c, r) => updateChild(c, r, ID), { method: "PATCH", body })).status, 400, JSON.stringify(body));
  assert.deepEqual(calls, []);
  const ok = await call((c, r) => updateChild(c, r, ID), { method: "PATCH", body: { full_name: " Anak ", birth_date: "2024-01-01", gender: "female", general_notes: "" } });
  assert.equal(ok.status, 200);
  assert.deepEqual(calls[0].args, { p_child_id: ID, p_full_name: "Anak", p_birth_date: "2024-01-01", p_gender: "female", p_general_notes: null });
  const conflict = setup({ rpcError: "child_has_enrollment_history" });
  assert.equal((await conflict.call(c => archiveChild(c, ID), { method: "DELETE" })).status, 409);
});

test("enrollment creation requires both consents and records the server-side wording", async () => {
  const { call, calls } = setup({ rpcResults: { app_create_enrollment: ID2, app_get_enrollment: { id: ID2, status: "pending" } } });
  const base = { child_id: ID, offering_id: ID2, service_date: tomorrow };
  for (const consents of [undefined, {}, { service_terms: true }, { service_terms: true, child_data_processing: "yes" }]) {
    const { status, data } = await call(createEnrollment, { method: "POST", body: { ...base, consents } });
    assert.equal(status, 400);
    assert.equal(data.code, "invalid_consent");
  }
  assert.equal((await call(createEnrollment, { method: "POST", body: { ...base, service_date: "2020-01-01", consents: { service_terms: true, child_data_processing: true } } })).status, 400);
  assert.deepEqual(calls, []);
  const { status, data } = await call(createEnrollment, {
    method: "POST", status: 201, headers: { "Idempotency-Key": "enroll-key-123456" },
    body: { ...base, consents: { service_terms: true, child_data_processing: true } },
  });
  assert.equal(status, 201);
  assert.equal(data.status, "pending");
  const args = calls[0].args;
  assert.equal(args.p_policy_version, ENROLLMENT_CONSENT.version);
  assert.equal(args.p_consent_scope.service_terms, true);
  assert.equal(args.p_consent_scope.child_data_processing, true);
  assert.ok(args.p_wording_snapshot.length > 50);
  assert.equal(args.p_request_id, "enroll-key-123456");
});

test("manager actions map to the matching RPC and validate per action", async () => {
  const { call, calls } = setup({ rpcResults: { app_get_enrollment: { id: ID } } });
  const patch = body => call((c, r) => updateEnrollment(c, r, ID), { method: "PATCH", body });
  assert.equal((await patch({ action: "approve" })).status, 400);
  assert.equal((await patch({ action: "decide", decision: "accepted", reason: "ok" })).status, 400);
  assert.equal((await patch({ action: "assign_caregiver", caregiver_id: ID2, starts_at: "2026-01-02T00:00:00Z", ends_at: "2026-01-01T00:00:00Z" })).status, 400);
  assert.deepEqual(calls, []);
  await patch({ action: "decide", decision: "accepted", reason: "Slot tersedia" });
  await patch({ action: "assign_caregiver", caregiver_id: ID2, starts_at: "2026-01-01T01:00:00Z", ends_at: "2026-01-01T09:00:00Z" });
  await patch({ action: "check_in" });
  await patch({ action: "complete" });
  assert.deepEqual(calls.filter(c => c.name !== "app_get_enrollment").map(c => c.name), [
    "app_manager_decide_enrollment", "app_manager_assign_caregiver", "app_manager_check_in_enrollment", "app_manager_complete_enrollment",
  ]);
  const full = setup({ rpcError: "daycare_capacity_full" });
  assert.equal((await full.call((c, r) => updateEnrollment(c, r, ID), { method: "PATCH", body: { action: "decide", decision: "accepted", reason: "Slot tersedia" } })).status, 409);
});

test("parent cancel works without a body and maps the pending-only rule", async () => {
  const { call, calls } = setup({ rpcResults: { app_get_enrollment: { id: ID, status: "cancelled" } } });
  assert.equal((await call((c, r) => cancelEnrollment(c, r, ID), { method: "DELETE" })).status, 200);
  assert.equal(calls[0].name, "app_parent_cancel_enrollment");
  const refused = setup({ rpcError: "enrollment_cannot_be_cancelled" });
  assert.equal((await refused.call((c, r) => cancelEnrollment(c, r, ID), { method: "DELETE" })).status, 409);
});

test("payment uses the enrollment's open charge and never exceeds its deadline", async () => {
  const dueAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { call, calls } = setup({ rpcResults: {
    app_get_enrollment: { id: ID, charge: { id: ID2, status: "open", total_amount: 150000, currency: "IDR", due_at: dueAt } },
    app_create_payment_ledger_entry: PARENT,
  } });
  assert.equal((await call((c, r) => createPayment(c, r, ID), { method: "POST", body: { method: "cash" } })).status, 400);
  const { status, data } = await call((c, r) => createPayment(c, r, ID), { method: "POST", status: 201, body: { method: "qris" } });
  assert.equal(status, 201);
  assert.equal(data.amount, 150000);
  // No merchant QRIS configured in tests: a marked demo QR (real PNG).
  assert.equal(data.qr.mode, "demo");
  assert.equal(data.qr.confirmation, "manual_admin");
  assert.match(data.qr.image_data_url, /^data:image\/png;base64,/);
  const va = await call((c, r) => createPayment(c, r, ID), { method: "POST", status: 201, body: { method: "va" } });
  assert.equal(va.data.qr, undefined);
  const args = calls.find(c => c.name === "app_create_payment_ledger_entry").args;
  assert.equal(args.p_charge_id, ID2);
  assert.ok(Date.parse(args.p_expires_at) <= Date.parse(dueAt));
  const noCharge = setup({ rpcResults: { app_get_enrollment: { id: ID, charge: null } } });
  assert.equal((await noCharge.call((c, r) => createPayment(c, r, ID), { method: "POST", body: { method: "qris" } })).status, 409);
});

test("daily activity: urgent needs a reason, updates need a change reason", async () => {
  const { call, calls } = setup({ rpcResults: { app_save_daily_activity: ID2 } });
  const body = { report_date: "2026-01-01", activity_type: "meal", title: "Makan siang", body: "Menghabiskan nasi, sayur, dan buah.", occurred_at: new Date().toISOString(), status: "sent" };
  assert.equal((await call((c, r) => saveActivity(c, r, ID), { method: "POST", body: { ...body, is_urgent: true } })).status, 400);
  assert.equal((await call((c, r) => saveActivity(c, r, ID, ID2), { method: "PATCH", body })).status, 400);
  assert.equal((await call((c, r) => saveActivity(c, r, ID), { method: "POST", body: { ...body, body: "pendek" } })).status, 400);
  assert.deepEqual(calls, []);
  assert.equal((await call((c, r) => saveActivity(c, r, ID), { method: "POST", body, status: 201 })).status, 201);
  assert.equal(calls[0].args.p_activity_id, null);
  assert.equal(calls[0].args.p_is_urgent, false);
  const sent = setup({ rpcError: "sent_activity_is_immutable" });
  assert.equal((await sent.call(c => deleteDraftActivity(c, ID2), { method: "DELETE" })).status, 409);
  assert.equal((await setup().call((c, r) => acknowledgeActivity(c, r, ID2), { method: "POST", body: { type: "seen" } })).status, 400);
});

test("incidents validate content and use the Idempotency-Key as submission key", async () => {
  const { call, calls } = setup({ rpcResults: { app_create_incident: ID2 } });
  const body = { enrollment_id: ID, occurred_at: new Date().toISOString(), description: "Anak terbentur meja saat bermain di dalam.", first_aid: "Kompres dingin", urgency: "medium", urgency_reason: "Benjolan kecil" };
  assert.equal((await call(createIncident, { method: "POST", body: { ...body, urgency: "darurat" } })).status, 400);
  assert.equal((await call(createIncident, { method: "POST", body: { ...body, description: "pendek" } })).status, 400);
  assert.equal((await call(createIncident, { method: "POST", body, status: 201, headers: { "Idempotency-Key": "incident-key-0001" } })).status, 201);
  assert.equal(calls[0].args.p_submission_key, "incident-key-0001");
  assert.equal((await call((c, r) => updateIncidentStatus(c, r, ID2), { method: "PATCH", body: { status: "resolved", reason: "singkat" } })).status, 400);
  const scope = setup({ rpcError: "incident_review_scope_required" });
  assert.equal((await scope.call((c, r) => updateIncidentStatus(c, r, ID2), { method: "PATCH", body: { status: "resolved", reason: "Sudah ditangani pengelola" } })).status, 403);
});

test("reviews and moderation validate rating, kind and decision", async () => {
  const { call } = setup({ rpcResults: { app_submit_review: ID2 } });
  assert.equal((await call(submitReview, { method: "POST", body: { enrollment_id: ID, rating: 6, body: "Pengasuhnya sangat sabar dan ramah." } })).status, 400);
  assert.equal((await call(submitReview, { method: "POST", body: { enrollment_id: ID, rating: 4.5, body: "Pengasuhnya sangat sabar dan ramah." } })).status, 400);
  assert.equal((await call(submitReview, { method: "POST", status: 201, body: { enrollment_id: ID, rating: 5, body: "Pengasuhnya sangat sabar dan ramah." } })).status, 201);
  assert.equal((await call((c, r) => moderate(c, r, "photos", ID2), { method: "PATCH", body: { decision: "approved", reason: "Sesuai" } })).status, 400);
  const notAdmin = setup({ rpcError: "admin_review_decision_required" });
  assert.equal((await notAdmin.call((c, r) => moderate(c, r, "reviews", ID2), { method: "PATCH", body: { decision: "approved", reason: "Sesuai pedoman" } })).status, 403);
});

test("notifications clamp the limit and admin payment results validate status", async () => {
  const { call, calls } = setup({ rpcResults: { app_list_my_notifications: { unread_count: 0, items: [] } } });
  assert.equal((await call(c => listNotifications(c, new URLSearchParams("limit=500")))).status, 400);
  await call(c => listNotifications(c, new URLSearchParams("unread=true&limit=20")));
  assert.deepEqual(calls[0].args, { p_only_unread: true, p_limit: 20 });
  assert.equal((await call((c, r) => recordPaymentResult(c, r, ID), { method: "PATCH", body: { status: "paid", provider: "manual", reason: "Sudah transfer" } })).status, 400);
  const notAdmin = setup({ rpcError: "admin_payment_result_required" });
  assert.equal((await notAdmin.call((c, r) => recordPaymentResult(c, r, ID), { method: "PATCH", body: { status: "succeeded", provider: "manual", reason: "Sudah transfer" } })).status, 403);
});

test("manager queue passes the daycare filter and rejects malformed ids", async () => {
  const { call, calls } = setup({ rpcResults: { app_list_enrollments: [] } });
  assert.equal((await call(c => listEnrollments(c, new URLSearchParams("daycare_id=abc")))).status, 400);
  await call(c => listEnrollments(c, new URLSearchParams(`daycare_id=${ID}`)));
  assert.deepEqual(calls[0].args, { p_daycare_id: ID });
});

test("logbook love and comments validate input and call the matching RPC", async () => {
  const { call, calls } = setup({ rpcResults: {
    app_set_activity_reaction: args => ({ activity_id: args.p_activity_id, loved_by_me: args.p_active, love_count: args.p_active ? 1 : 0 }),
    app_add_activity_comment: args => ({ id: ID2, body: args.p_body, author_role: "parent" }),
    app_list_activity_comments: [],
  } });
  let r = await call(context => setActivityLove(context, ID, true), { method: "PUT" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { activity_id: ID, loved_by_me: true, love_count: 1 });
  r = await call(context => setActivityLove(context, ID, false), { method: "DELETE" });
  assert.equal(r.data.love_count, 0);
  r = await call(context => setActivityLove(context, "x", true), { method: "PUT" });
  assert.equal(r.data.code, "invalid_activity_id");

  r = await call((context, request) => addActivityComment(context, request, ID), { method: "POST", status: 201, body: { body: "  Terima kasih!  " }, headers: { "Idempotency-Key": "comment-key-0001" } });
  assert.equal(r.status, 201);
  const add = calls.find(c => c.name === "app_add_activity_comment");
  assert.deepEqual(add.args, { p_activity_id: ID, p_body: "Terima kasih!", p_request_id: "comment-key-0001" });
  for (const body of [{ body: "" }, { body: "x".repeat(1001) }, { body: 5 }]) {
    r = await call((context, request) => addActivityComment(context, request, ID), { method: "POST", body });
    assert.equal(r.data.code, "invalid_body", JSON.stringify(body));
  }
  r = await call((context, request) => addActivityComment(context, request, ID), { method: "POST", body: { body: "ok", author: "x" } });
  assert.equal(r.data.code, "invalid_fields");

  r = await call(context => listActivityComments(context, ID));
  assert.deepEqual(r.data, []);
  r = await call(context => deleteActivityComment(context, ID, ID2), { method: "DELETE" });
  assert.deepEqual(r.data, { id: ID2, deleted: true });
  r = await call(context => deleteActivityComment(context, ID, "bad"), { method: "DELETE" });
  assert.equal(r.data.code, "invalid_comment_id");
});

test("logbook interaction errors map to the documented status codes", async () => {
  for (const [code, status] of [["reaction_not_allowed", 403], ["activity_not_found", 404], ["comment_delete_not_allowed", 403], ["comment_not_found", 404], ["invalid_comment_body", 400]]) {
    const { call } = setup({ rpcError: code });
    const r = await call(context => setActivityLove(context, ID, true), { method: "PUT" });
    assert.equal(r.status, status, code);
    assert.equal(r.data.code, code);
  }
});
