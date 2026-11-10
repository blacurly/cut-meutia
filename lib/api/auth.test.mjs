import test from "node:test";
import assert from "node:assert/strict";
import { apiRoute } from "./http.js";
import { login, logout, register } from "./auth.js";

const USER = { id: "11111111-1111-4111-8111-111111111111", email: "bunda@example.com" };
const SESSION = { access_token: "jwt-token", refresh_token: "refresh-secret", expires_at: 1900000000 };

function auth({ signUp, signIn, profile = { role: "parent", status: "active", full_name: "Bunda" } } = {}) {
  const calls = [];
  const supabase = {
    calls,
    auth: {
      async signUp(args) { calls.push(["signUp", args]); return signUp ?? { data: { user: USER, session: SESSION }, error: null }; },
      async signInWithPassword(args) { calls.push(["signIn", args]); return signIn ?? { data: { user: USER, session: SESSION }, error: null }; },
      async signOut() { calls.push(["signOut"]); return { error: null }; },
    },
    from() {
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: profile, error: null }) };
      return query;
    },
  };
  const call = async (handler, body, { status = 200, headers = {} } = {}) => {
    const response = await apiRoute(async () => ({ supabase, user: null }), handler, status)(new Request("http://localhost:3000/api/auth/x", {
      method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
    }));
    return { status: response.status, data: await response.json() };
  };
  return { supabase, call };
}

const valid = { email: " Bunda@Example.com ", password: "rahasia123", full_name: "Bunda Sari", phone: "0812-3456-7890", terms: true };

test("register validates every field before calling Supabase", async () => {
  const cases = [
    [{ ...valid, full_name: "A" }, "invalid_full_name"],
    [{ ...valid, email: "bukan-email" }, "invalid_email"],
    [{ ...valid, phone: "12345" }, "invalid_phone"],
    [{ ...valid, password: "pendek1" }, "invalid_password"],
    [{ ...valid, password: "tanpaangka" }, "invalid_password"],
    [{ ...valid, terms: "yes" }, "invalid_terms"],
    [{ ...valid, role: "admin" }, "invalid_fields"],
  ];
  for (const [body, code] of cases) {
    const { supabase, call } = auth();
    const r = await call(register, body, { status: 201 });
    assert.equal(r.status, 400, code);
    assert.equal(r.data.code, code);
    assert.equal(supabase.calls.length, 0, `${code} must not reach Supabase`);
  }
});

test("register creates a parent with normalized data and never returns the refresh token", async () => {
  const { supabase, call } = auth();
  const r = await call(register, valid, { status: 201 });
  assert.equal(r.status, 201);
  const [, args] = supabase.calls[0];
  assert.equal(args.email, "bunda@example.com");
  assert.deepEqual(args.options.data, { full_name: "Bunda Sari", phone: "81234567890" });
  assert.equal(args.options.emailRedirectTo, "http://localhost:3000/auth/callback?next=/beranda");
  assert.deepEqual(r.data.session, { access_token: "jwt-token", token_type: "bearer", expires_at: 1900000000 });
  assert.equal(JSON.stringify(r.data).includes("refresh-secret"), false);
  assert.equal(r.data.role, "parent");
});

test("register with email confirmation hides whether the email already exists", async () => {
  const { call } = auth({ signUp: { data: { user: { ...USER, identities: [] }, session: null }, error: null } });
  const r = await call(register, valid, { status: 201 });
  assert.deepEqual(r.data, { user: null, role: "parent", needs_email_confirmation: true, session: null, redirect_to: null });
});

test("Supabase auth errors map to stable API codes", async () => {
  for (const [error, status, code] of [
    [{ code: "email_exists", status: 422 }, 409, "email_already_registered"],
    [{ code: "over_email_send_rate_limit", status: 429 }, 429, "too_many_requests"],
    [{ code: "something_new", status: 500, message: "db down" }, 502, "auth_unavailable"],
  ]) {
    const { call } = auth({ signUp: { data: { user: null, session: null }, error } });
    const r = await call(register, valid, { status: 201 });
    assert.equal(r.status, status);
    assert.equal(r.data.code, code);
    assert.equal(JSON.stringify(r.data).includes("db down"), false);
  }
});

test("login returns the profile role and redirect, and enforces the chosen portal", async () => {
  let { call } = auth();
  let r = await call(login, { email: "bunda@example.com", password: "rahasia123", role: "parent" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.profile, { role: "parent", full_name: "Bunda" });
  assert.equal(r.data.redirect_to, "/beranda");

  const manager = auth({ profile: { role: "manager", status: "active", full_name: "Pengelola" } });
  r = await manager.call(login, { email: "m@example.com", password: "x", role: "caregiver" });
  assert.equal(r.data.redirect_to, "/pengelola");
  r = await manager.call(login, { email: "m@example.com", password: "x", role: "parent" });
  assert.equal(r.status, 403);
  assert.equal(r.data.code, "role_not_allowed");
  assert.deepEqual(manager.supabase.calls.at(-1), ["signOut"]);

  const inactive = auth({ profile: { role: "parent", status: "suspended" } });
  r = await inactive.call(login, { email: "b@example.com", password: "x" });
  assert.equal(r.data.code, "account_not_active");

  ({ call } = auth({ signIn: { data: { user: null, session: null }, error: { code: "invalid_credentials", status: 400 } } }));
  r = await call(login, { email: "b@example.com", password: "salah" });
  assert.equal(r.status, 401);
  assert.equal(r.data.code, "invalid_credentials");

  r = await call(login, { email: "b@example.com", password: "x", role: "superuser" });
  assert.equal(r.data.code, "invalid_role");
});

test("auth endpoints reject cross-site form posts", async () => {
  const { supabase, call } = auth();
  const r = await call(login, { email: "b@example.com", password: "x" }, { headers: { Origin: "https://evil.example" } });
  assert.equal(r.status, 403);
  assert.equal(supabase.calls.length, 0);
});

test("logout always succeeds for the current cookie session", async () => {
  const { call } = auth();
  const r = await call(logout, {});
  assert.deepEqual(r.data, { signed_out: true });
});
