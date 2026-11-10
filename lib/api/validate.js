// Input validation shared by the API services. Every check throws an ApiError
// with status 400 and a field-specific code, before any database call.
import { ApiError } from "./http.js";
import { databaseData } from "./errors.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const invalid = (field, message) => { throw new ApiError(400, `invalid_${field}`, message); };

export function uuid(value, field = "id", label = "ID") {
  if (typeof value !== "string" || !UUID.test(value)) invalid(field, `${label} tidak valid.`);
  return value;
}

export function text(value, field, { min = 0, max, label, optional = false } = {}) {
  if (value == null && optional) return null;
  if (typeof value !== "string") invalid(field, `${label} wajib diisi.`);
  const trimmed = value.trim();
  if (optional && !trimmed) return null;
  if (trimmed.length < min || (max && trimmed.length > max)) {
    invalid(field, max ? `${label} harus ${min}–${max} karakter.` : `${label} minimal ${min} karakter.`);
  }
  return trimmed;
}

export function oneOf(value, field, options, label) {
  if (!options.includes(value)) invalid(field, `${label} harus salah satu dari: ${options.join(", ")}.`);
  return value;
}

export function integer(value, field, { min, max, label }) {
  if (!Number.isInteger(value) || value < min || value > max) invalid(field, `${label} harus bilangan bulat ${min}–${max}.`);
  return value;
}

export function boolean(value, field, label) {
  if (typeof value !== "boolean") invalid(field, `${label} harus true atau false.`);
  return value;
}

// YYYY-MM-DD that is a real calendar date.
export function isoDate(value, field, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)
      || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    invalid(field, `${label} harus berformat YYYY-MM-DD.`);
  }
  return value;
}

export function timestamp(value, field, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) {
    invalid(field, `${label} harus berupa waktu ISO 8601.`);
  }
  return new Date(value).toISOString();
}

// Today in Asia/Jakarta, the timezone used for service dates.
export const todayJakarta = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

// Client-supplied idempotency key (header) or a server-generated one.
export function requestId(request) {
  const header = request?.headers?.get("idempotency-key")?.trim();
  if (header && !/^[A-Za-z0-9._:-]{12,100}$/.test(header)) invalid("idempotency_key", "Idempotency-Key harus 12–100 karakter alfanumerik.");
  return header || crypto.randomUUID();
}

export async function rpc({ supabase }, name, args = {}) {
  return databaseData(await supabase.rpc(name, args));
}
