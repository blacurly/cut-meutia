import test from "node:test";
import assert from "node:assert/strict";
import { apiRoute, makeAuthenticate } from "./http.js";
import { getMe, updateMe, createChild, getChildHealth, updateChildHealth } from "./parent.js";

const parentId = "11111111-1111-4111-8111-111111111111";
const childId = "22222222-2222-4222-8222-222222222222";
const foreignId = "33333333-3333-4333-8333-333333333333";

function fixture({ role = "parent", status = "active", deleted = false, rpcError = null } = {}) {
  const tables = {
    users: [{ id: parentId, role, status, full_name: "Parent", phone: null, deleted_at: deleted ? "2026-01-01" : null }],
    children: [
      { child_id: childId, parent_id: parentId, full_name: "My child", birth_date: "2024-01-01", status: "active", created_at: "2026-01-01", deleted_at: null },
      { child_id: foreignId, parent_id: "someone-else", full_name: "Other child", deleted_at: null },
      { child_id: "44444444-4444-4444-8444-444444444444", parent_id: parentId, full_name: "Deleted child", deleted_at: "2026-01-01" },
    ],
    child_health_profiles: [{ child_id: childId, allergies: "", medical_history: "", special_needs: "", medication_notes: "", version: 2 }],
  };
  const writes = [], reads = [];
  const supabase = {
    auth: { async getUser(token) { return token === "expired" ? { data: { user: null }, error: new Error("expired") } : { data: { user: { id: parentId } }, error: null }; } },
    from(table) {
      reads.push(table);
      const predicates = [];
      let columns, single = false;
      const query = {
        select(value) { columns = value.split(",").map(key => key.trim()); return query; },
        eq(key, value) { predicates.push(row => row[key] === value); return query; },
        is(key, value) { predicates.push(row => (row[key] ?? null) === value); return query; },
        order() { return query; },
        maybeSingle() { single = true; return query; },
        then(resolve) {
          const rows = tables[table].filter(row => predicates.every(match => match(row)))
            .map(row => Object.fromEntries(columns.map(key => [key, row[key]])));
          return Promise.resolve({ data: single ? rows[0] || null : rows, error: null }).then(resolve);
        },
      };
      return query;
    },
    async rpc(name, args) { writes.push({ name, args }); return { data: name === "app_parent_update_child_health" ? 3 : childId, error: rpcError }; },
  };
  const authentication = makeAuthenticate({ cookieClient: () => supabase, bearerClient: () => supabase });
  const call = async (handler, { method = "GET", body, id, headers = {}, raw } = {}) => {
    const request = new Request("http://localhost:3000/api/test", {
      method, headers: { ...(body !== undefined || raw !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      ...(body !== undefined || raw !== undefined ? { body: raw ?? JSON.stringify(body) } : {}),
    });
    const response = await apiRoute(authentication, (context, req) => handler(context, req, id), handler === createChild ? 201 : 200)(request);
    return { response, data: await response.json() };
  };
  return { call, writes, reads, authentication, supabase };
}

test("account API returns only the caller's non-deleted children and disables caching", async () => {
  const { call } = fixture();
  const { response, data } = await call(getMe);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(data.children.map(child => child.child_id), [childId]);
  assert.equal(Object.hasOwn(data.children[0], "parent_id"), false);
  assert.equal(Object.hasOwn(data.profile, "deleted_at"), false);
});

test("untrusted/expired credentials and inactive, deleted, or non-parent accounts cannot access account data", async () => {
  for (const headers of [{ Authorization: "Bearer expired" }, { Authorization: "Basic invalid" }]) {
    const { call, reads } = fixture();
    assert.equal((await call(getMe, { headers })).response.status, 401);
    assert.deepEqual(reads, []);
  }
  for (const options of [{ role: "manager" }, { status: "suspended" }, { deleted: true }]) {
    const { call, reads } = fixture(options);
    assert.equal((await call(getMe)).response.status, 403);
    assert.deepEqual(reads, ["users"]);
  }
});

test("cookie and bearer requests both validate the user with Supabase", async () => {
  const tokens = [];
  const client = { auth: { async getUser(token) { tokens.push(token); return { data: { user: { id: parentId } }, error: null }; } } };
  let cookieCalls = 0;
  const authenticate = makeAuthenticate({ cookieClient: () => { cookieCalls++; return client; }, bearerClient: token => { assert.equal(token, "valid-token"); return client; } });
  await authenticate(new Request("http://localhost:3000/api/me"));
  await authenticate(new Request("http://localhost:3000/api/me", { headers: { Authorization: "Bearer valid-token" } }));
  assert.equal(cookieCalls, 1);
  assert.deepEqual(tokens, [undefined, "valid-token"]);
});

test("profile updates normalize input and preserve the existing RPC", async () => {
  const { call, writes } = fixture();
  const { response, data } = await call(updateMe, { method: "PATCH", body: { full_name: "  Bunda Ann  ", phone: "+62 812-3456-7890" } });
  assert.equal(response.status, 200);
  assert.equal(data.profile.full_name, "Bunda Ann");
  assert.deepEqual(writes, [{ name: "app_update_parent_profile", args: { p_full_name: "Bunda Ann", p_phone: "81234567890" } }]);
});

test("malformed requests, cross-site writes, and ownership injection never reach an RPC", async () => {
  const { call, writes } = fixture();
  for (const request of [
    { raw: "{" },
    { body: [] },
    { body: { full_name: "Parent", role: "admin" } },
    { body: { full_name: "A" } },
    { body: { full_name: "Parent", phone: 123 } },
  ]) assert.equal((await call(updateMe, { method: "PATCH", ...request })).response.status, 400);
  assert.equal((await call(updateMe, { method: "PATCH", body: {}, headers: { Origin: "https://other-site.example" } })).response.status, 403);
  assert.equal((await call(updateMe, { method: "PATCH", raw: "full_name=Parent", headers: { "Content-Type": "application/x-www-form-urlencoded" } })).response.status, 415);
  assert.equal((await call(createChild, { method: "POST", body: { full_name: "Child", birth_date: "2024-01-01", parent_id: "someone-else" } })).response.status, 400);
  assert.deepEqual(writes, []);
});

test("child creation rejects invalid calendar dates and returns the RPC-created ID", async () => {
  const { call, writes } = fixture();
  for (const birth_date of ["2024-02-30", "2100-01-01", null, "bad-date"]) {
    assert.equal((await call(createChild, { method: "POST", body: { full_name: "Child", birth_date } })).response.status, 400);
  }
  assert.deepEqual(writes, []);
  const { response, data } = await call(createChild, { method: "POST", body: { full_name: "Child", birth_date: "2024-02-29" } });
  assert.equal(response.status, 201);
  assert.equal(data.child_id, childId);
  assert.equal(writes[0].name, "app_create_parent_child");
});

test("foreign children cannot be read or updated, and malformed IDs return 400", async () => {
  const { call, writes, reads } = fixture();
  const read = (context, _req, id) => getChildHealth(context, id);
  assert.equal((await call(read, { id: "bad-id" })).response.status, 400);
  assert.equal((await call(read, { id: foreignId })).response.status, 404);
  assert.equal((await call(updateChildHealth, { method: "PATCH", id: foreignId, body: {} })).response.status, 404);
  assert.equal(reads.includes("child_health_profiles"), false);
  assert.deepEqual(writes, []);
  const { data } = await call(read, { id: childId });
  assert.equal(data.health.version, 2);
});

test("health changes preserve audit RPC arguments and reject omitted or oversized fields", async () => {
  const { call, writes } = fixture();
  const body = { allergies: "Peanuts", medical_history: "", special_needs: "", medication_notes: "", reason: " Updated " };
  assert.equal((await call(updateChildHealth, { method: "PATCH", id: childId, body: { reason: "" } })).response.status, 400);
  assert.equal((await call(updateChildHealth, { method: "PATCH", id: childId, body: { ...body, allergies: "x".repeat(4001) } })).response.status, 400);
  assert.deepEqual(writes, []);
  const { data } = await call(updateChildHealth, { method: "PATCH", id: childId, body });
  assert.equal(data.version, 3);
  assert.equal(writes[0].name, "app_parent_update_child_health");
  assert.equal(writes[0].args.p_child_id, childId);
  assert.equal(writes[0].args.p_reason, "Updated");
});

test("database authorization errors are mapped and unexpected database details are not exposed", async () => {
  const denied = fixture({ rpcError: { message: "child_not_owned" } });
  assert.equal((await denied.call(updateMe, { method: "PATCH", body: { full_name: "Parent" } })).response.status, 404);
  const failure = fixture({ rpcError: { message: "secret database details" } });
  const { response, data } = await failure.call(updateMe, { method: "PATCH", body: { full_name: "Parent" } });
  assert.equal(response.status, 500);
  assert.equal(JSON.stringify(data).includes("secret database details"), false);
});
