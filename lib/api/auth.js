// POST /api/auth/register, /api/auth/login, /api/auth/logout.
// Thin Route Handler wrappers around Supabase Auth. The session is written to
// HttpOnly-capable cookies by the @supabase/ssr server client, so the web app
// keeps working as before; API clients (Postman, mobile) can use the returned
// access_token as "Authorization: Bearer ...".
//
// Self-registration only creates Parent accounts (the auth.users trigger
// assigns role 'parent'); staff accounts are invited by a daycare/admin.
import { ApiError, readObject } from "./http.js";
import { normalizePhone, passwordCriteria } from "../auth.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DESTINATION = { parent: "/beranda", manager: "/pengelola", caregiver: "/pengelola", admin: "/admin" };
const LOGIN_ROLES = { parent: ["parent"], caregiver: ["manager", "caregiver"], admin: ["admin"] };

const bad = (code, message) => { throw new ApiError(400, code, message); };

// Supabase Auth error codes -> API errors. Wording never reveals whether an
// email is registered, except where Supabase itself does (email_exists).
const AUTH_ERRORS = {
  invalid_credentials: [401, "invalid_credentials", "Email atau kata sandi salah."],
  email_not_confirmed: [403, "email_not_confirmed", "Konfirmasi email Anda terlebih dahulu melalui tautan yang kami kirim."],
  user_already_exists: [409, "email_already_registered", "Email sudah terdaftar. Silakan masuk."],
  email_exists: [409, "email_already_registered", "Email sudah terdaftar. Silakan masuk."],
  weak_password: [400, "invalid_password", "Kata sandi terlalu lemah. Gunakan minimal 8 karakter berisi huruf dan angka."],
  signup_disabled: [403, "signup_disabled", "Pendaftaran akun sedang ditutup."],
  over_request_rate_limit: [429, "too_many_requests", "Terlalu banyak percobaan. Coba lagi beberapa menit lagi."],
  over_email_send_rate_limit: [429, "too_many_requests", "Terlalu banyak percobaan. Coba lagi beberapa menit lagi."],
};

function authError(error) {
  const known = AUTH_ERRORS[error?.code];
  if (known) throw new ApiError(...known);
  if (error?.status === 429) throw new ApiError(...AUTH_ERRORS.over_request_rate_limit);
  if (error?.status === 400 && /invalid login credentials/i.test(error?.message || "")) throw new ApiError(...AUTH_ERRORS.invalid_credentials);
  throw new ApiError(502, "auth_unavailable", "Layanan autentikasi belum dapat diproses. Coba lagi beberapa saat.");
}

const sessionInfo = session => session
  ? { access_token: session.access_token, token_type: "bearer", expires_at: session.expires_at }
  : null;

function email(value) {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!EMAIL.test(text) || text.length > 254) bad("invalid_email", "Masukkan alamat email yang valid.");
  return text;
}

export async function register({ supabase }, request) {
  const body = await readObject(request, ["email", "password", "full_name", "phone", "terms"]);
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  if (fullName.length < 2 || fullName.length > 100) bad("invalid_full_name", "Nama harus terdiri dari 2 sampai 100 karakter.");
  const address = email(body.email);
  const phone = normalizePhone(body.phone);
  if (!/^8\d{8,11}$/.test(phone)) bad("invalid_phone", "Masukkan nomor WhatsApp Indonesia yang valid, mis. 0812xxxxxxx.");
  const password = typeof body.password === "string" ? body.password : "";
  if (!Object.values(passwordCriteria(password)).every(Boolean) || password.length > 128) {
    bad("invalid_password", "Kata sandi minimal 8 karakter dan berisi huruf serta angka.");
  }
  if (body.terms !== true) bad("invalid_terms", "Setujui syarat layanan dan kebijakan privasi untuk mendaftar.");

  const { data, error } = await supabase.auth.signUp({
    email: address,
    password,
    options: {
      emailRedirectTo: `${new URL(request.url).origin}/auth/callback?next=/beranda`,
      data: { full_name: fullName, phone },
    },
  });
  if (error) authError(error);
  // With email confirmation on, Supabase returns no session (and, for an
  // existing email, a placeholder user). The response is identical in both
  // cases so the endpoint cannot be used to discover registered emails.
  return {
    user: data.session ? { id: data.user.id, email: data.user.email } : null,
    role: "parent",
    needs_email_confirmation: !data.session,
    session: sessionInfo(data.session),
    redirect_to: data.session ? DESTINATION.parent : null,
  };
}

export async function login({ supabase }, request) {
  const body = await readObject(request, ["email", "password", "role"]);
  const address = email(body.email);
  if (typeof body.password !== "string" || !body.password || body.password.length > 128) {
    bad("invalid_password", "Masukkan kata sandi.");
  }
  if (body.role != null && !Object.hasOwn(LOGIN_ROLES, body.role)) bad("invalid_role", "Peran harus parent, caregiver, atau admin.");

  const { data, error } = await supabase.auth.signInWithPassword({ email: address, password: body.password });
  if (error) authError(error);

  const { data: profile, error: profileError } = await supabase.from("users")
    .select("role, status, full_name").eq("id", data.user.id).maybeSingle();
  if (profileError || !profile || profile.status !== "active") {
    await supabase.auth.signOut({ scope: "local" });
    throw new ApiError(403, "account_not_active", "Akun belum aktif atau profil tidak ditemukan. Hubungi tim Ayomi.");
  }
  if (body.role && !LOGIN_ROLES[body.role].includes(profile.role)) {
    await supabase.auth.signOut({ scope: "local" });
    throw new ApiError(403, "role_not_allowed", "Akun ini tidak terdaftar untuk peran yang dipilih.");
  }
  return {
    user: { id: data.user.id, email: data.user.email },
    profile: { role: profile.role, full_name: profile.full_name },
    session: sessionInfo(data.session),
    redirect_to: DESTINATION[profile.role] || "/",
  };
}

export async function logout({ supabase }) {
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error && error.status !== 401 && error.status !== 403) authError(error);
  return { signed_out: true };
}
