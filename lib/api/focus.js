// /api/ai/focus/* — Foto Fokus Anak (trial).
//
// POST /api/ai/focus/segment   multipart `file` -> people (class, confidence,
//                              polygon) + suggested_target_id
// POST /api/ai/focus/render    multipart `file` + `target_polygon` (JSON
//                              [[x,y],...]) -> JPEG with only the target sharp
//
// The browser never talks to the CV service: this server checks the session
// and role, validates the photo by its bytes, rate-limits, and forwards it
// with the secret token (CV_API_URL, CV_API_TOKEN). Photos are not stored
// here; storing per-child variants belongs to the logbook flow.
import { ApiError } from "./http.js";
import { readUpload } from "./uploads.js";
import { invalid } from "./validate.js";
import { AiError, providerError } from "../ai/errors.js";
import { takeToken } from "../ai/rate-limit.js";

export const FOCUS_PHOTO = { field: "file", maxBytes: 4 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"], label: "JPG, PNG, atau WebP maksimal 4 MB" };
const STAFF_ROLES = ["admin", "manager", "caregiver"];
const CLASSES = ["anak", "dewasa"];
const TIMEOUT_MS = 55_000;
const MAX_POINTS = 2000;
const MAX_IMAGE_BASE64 = 8 * 1024 * 1024;

const asApiError = error => new ApiError(error.status, error.code, error.message);

function cvConfig(env) {
  const url = env.CV_API_URL?.trim();
  const token = env.CV_API_TOKEN?.trim();
  if (!url || !token) throw asApiError(new AiError("MODEL_UNAVAILABLE"));
  return { url: url.replace(/\/+$/, ""), token };
}

// Staff only: an active Admin, or an active Manager/Caregiver account
// (users.role) or an active daycare membership.
async function requireStaff({ supabase, user }) {
  const { data, error } = await supabase.from("users").select("role, status").eq("id", user.id).maybeSingle();
  if (!error && data?.status === "active" && STAFF_ROLES.includes(data.role)) return;
  const { data: daycares } = await supabase.rpc("app_list_my_daycares");
  if (data?.status === "active" && Array.isArray(daycares) && daycares.length > 0) return;
  throw new ApiError(403, "staff_role_required", "Foto Fokus Anak hanya untuk Pengasuh, Pengelola, dan Admin.");
}

function limit(user) {
  const result = takeToken(`focus:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (!result.allowed) {
    throw new ApiError(429, "RATE_LIMITED", `Batas 30 foto per menit. Coba lagi dalam ${result.retryAfterSeconds} detik.`);
  }
}

async function callCv(path, file, fields, { fetchImpl, env }) {
  const { url, token } = cvConfig(env);
  const form = new FormData();
  form.append("file", new Blob([file.bytes], { type: file.mime }), `foto.${file.ext}`);
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  let response;
  try {
    response = await fetchImpl(`${url}${path}`, {
      method: "POST", body: form, cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    throw asApiError(new AiError(timedOut ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE"));
  }
  const payload = await response.json().catch(() => null);
  if (response.ok) {
    if (!payload || typeof payload !== "object") throw asApiError(new AiError("OUTPUT_INVALID"));
    return payload;
  }
  // The service rejects unreadable photos or a polygon outside the photo.
  if ([400, 413, 415].includes(response.status)) {
    throw new ApiError(422, "photo_rejected", typeof payload?.detail?.error === "string"
      ? payload.detail.error : "Foto tidak dapat diproses. Gunakan foto JPG, PNG, atau WebP yang lain.");
  }
  throw asApiError(providerError(response.status));
}

const isPoint = point => Array.isArray(point) && point.length === 2 && point.every(n => Number.isFinite(n) && n >= 0 && n <= 10_000);
const isPolygon = value => Array.isArray(value) && value.length >= 3 && value.length <= MAX_POINTS && value.every(isPoint);
const outputInvalid = () => { throw asApiError(new AiError("OUTPUT_INVALID")); };
const flags = value => (Array.isArray(value) ? value : []).filter(flag => typeof flag === "string" && /^[a-z_]{1,40}$/.test(flag)).slice(0, 10);
const meta = payload => ({
  model_version: typeof payload.model_version === "string" ? payload.model_version.slice(0, 80) : "unknown",
  latency_ms: Number.isFinite(payload.latency_ms) ? payload.latency_ms : null,
  ai_generated: true,
  requires_human_review: true,
});

function imageSize(value) {
  const width = value?.width, height = value?.height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 10_000 || height > 10_000) outputInvalid();
  return { width, height };
}

export function parseSegment(payload) {
  const size = imageSize(payload.image_size);
  if (!Array.isArray(payload.people) || payload.people.length > 100) outputInvalid();
  const people = payload.people.map(person => {
    if (!Number.isInteger(person?.id) || !CLASSES.includes(person.class) || !Number.isFinite(person.confidence)
      || person.confidence < 0 || person.confidence > 1 || !isPolygon(person.polygon)) outputInvalid();
    return { id: person.id, class: person.class, confidence: person.confidence, polygon: person.polygon };
  });
  const suggested = payload.suggested_target_id ?? null;
  if (suggested !== null && !people.some(person => person.id === suggested)) outputInvalid();
  return { image_size: size, people, suggested_target_id: suggested, quality_flags: flags(payload.quality_flags), ...meta(payload) };
}

export function parseRender(payload) {
  const size = imageSize(payload.image_size);
  const image = payload.image;
  if (image?.mime_type !== "image/jpeg" || typeof image.base64 !== "string" || image.base64.length > MAX_IMAGE_BASE64
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.base64)) outputInvalid();
  return {
    image_size: size, image: { mime_type: "image/jpeg", base64: image.base64 },
    other_people_blurred: Number.isInteger(payload.other_people_blurred) ? payload.other_people_blurred : 0,
    quality_flags: flags(payload.quality_flags), ...meta(payload),
  };
}

function targetPolygon(text) {
  if (typeof text !== "string" || text.length > 100_000) invalid("target_polygon", "Siluet anak target tidak valid.");
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    invalid("target_polygon", "Siluet anak target tidak valid.");
  }
  if (!isPolygon(value)) invalid("target_polygon", "Siluet anak target tidak valid.");
  return JSON.stringify(value.map(([x, y]) => [Math.round(x), Math.round(y)]));
}

async function prepare(context, request, fields) {
  await requireStaff(context);
  limit(context.user);
  return readUpload(request, fields, FOCUS_PHOTO);
}

export async function segmentPhoto(context, request, { fetchImpl = fetch, env = process.env } = {}) {
  const { file } = await prepare(context, request, []);
  return parseSegment(await callCv("/segment", file, {}, { fetchImpl, env }));
}

export async function renderPhoto(context, request, { fetchImpl = fetch, env = process.env } = {}) {
  const { values, file } = await prepare(context, request, ["target_polygon"]);
  const polygon = targetPolygon(values.target_polygon);
  return parseRender(await callCv("/render", file, { target_polygon: polygon }, { fetchImpl, env }));
}
