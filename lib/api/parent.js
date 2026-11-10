import { normalizePhone } from "../auth.js";
import { ApiError, readObject } from "./http.js";

const healthFields = ["allergies", "medical_history", "special_needs", "medication_notes"];
const rpcErrors = {
  not_authenticated: [401, "Sesi login berakhir. Masuk kembali lalu coba lagi."],
  parent_account_not_active: [403, "Halaman ini hanya tersedia untuk akun Orang Tua yang aktif."],
  child_not_owned: [404, "Profil anak tidak ditemukan."],
  invalid_parent_name: [400, "Nama harus terdiri dari 2 sampai 100 karakter."],
  invalid_parent_phone: [400, "Masukkan nomor WhatsApp Indonesia yang valid."],
  invalid_child_name: [400, "Nama anak harus terdiri dari 2 sampai 80 karakter."],
  invalid_child_birth_date: [400, "Masukkan tanggal lahir yang valid dan tidak berada di masa depan."],
  health_text_too_long: [400, "Setiap catatan kesehatan maksimal 4.000 karakter dan alasan maksimal 500 karakter."],
};

function reject(code) {
  const [status, message] = rpcErrors[code];
  throw new ApiError(status, code, message);
}

export function databaseData({ data, error }) {
  if (error) {
    if (Object.hasOwn(rpcErrors, error.message)) reject(error.message);
    throw new ApiError(500, "database_error", "Data belum dapat diproses. Coba lagi beberapa saat.");
  }
  return data;
}

async function requireParent({ supabase, user }) {
  const profile = databaseData(await supabase.from("users")
    .select("role, status, full_name, phone").eq("id", user.id).is("deleted_at", null).maybeSingle());
  if (!profile || profile.role !== "parent" || profile.status !== "active") reject("parent_account_not_active");
  return profile;
}

async function requireChild(context, id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || "")) {
    throw new ApiError(400, "invalid_child_id", "ID anak tidak valid.");
  }
  await requireParent(context);
  // public.children uses `id` as its primary key (see migrations 032/034/035).
  const child = databaseData(await context.supabase.from("children").select("id")
    .eq("id", id).eq("parent_id", context.user.id).is("deleted_at", null).maybeSingle());
  if (!child) reject("child_not_owned");
}

export async function getMe(context) {
  const profile = await requireParent(context);
  const children = databaseData(await context.supabase.from("children")
    .select("id, full_name, birth_date, status, created_at")
    .eq("parent_id", context.user.id).is("deleted_at", null).order("created_at", { ascending: false }));
  // The API contract exposes the key as `child_id`, matching POST /api/children.
  return { profile, children: (children || []).map(({ id, ...child }) => ({ child_id: id, ...child })) };
}

export async function updateMe(context, request) {
  const profile = await requireParent(context);
  const body = await readObject(request, ["full_name", "phone"]);
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  if (fullName.length < 2 || fullName.length > 100) reject("invalid_parent_name");
  if (body.phone != null && typeof body.phone !== "string") reject("invalid_parent_phone");
  const phone = normalizePhone(body.phone);
  if (phone && !/^8\d{8,11}$/.test(phone)) reject("invalid_parent_phone");
  databaseData(await context.supabase.rpc("app_update_parent_profile", { p_full_name: fullName, p_phone: phone || null }));
  return { profile: { ...profile, full_name: fullName, phone: phone || null } };
}

export async function createChild(context, request) {
  await requireParent(context);
  const body = await readObject(request, ["full_name", "birth_date"]);
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  if (fullName.length < 2 || fullName.length > 80) reject("invalid_child_name");
  const date = body.birth_date;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date || date > today) reject("invalid_child_birth_date");
  const childId = databaseData(await context.supabase.rpc("app_create_parent_child", { p_full_name: fullName, p_birth_date: date }));
  return { child_id: childId };
}

export async function getChildHealth(context, id) {
  await requireChild(context, id);
  const health = databaseData(await context.supabase.from("child_health_profiles")
    .select("allergies, medical_history, special_needs, medication_notes, version").eq("child_id", id).maybeSingle());
  return { health };
}

export async function updateChildHealth(context, request, id) {
  await requireChild(context, id);
  const body = await readObject(request, [...healthFields, "reason"]);
  if (healthFields.some(key => typeof body[key] !== "string") || (body.reason != null && typeof body.reason !== "string")) {
    throw new ApiError(400, "invalid_health_fields", "Catatan kesehatan harus berupa teks.");
  }
  if (healthFields.some(key => body[key].length > 4000) || (body.reason?.trim().length || 0) > 500) reject("health_text_too_long");
  const version = databaseData(await context.supabase.rpc("app_parent_update_child_health", {
    p_child_id: id, ...Object.fromEntries(healthFields.map(key => [`p_${key}`, body[key]])), p_reason: body.reason?.trim() || null,
  }));
  return { version };
}
