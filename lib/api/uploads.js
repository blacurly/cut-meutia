// Multipart uploads (Foto Fokus Anak). Partner documents and photos use
// lib/api/partner-onboarding.js.
// The file type is decided by its first bytes, never by the client's
// Content-Type or file name, and the size is checked before reading.
import { createHash } from "node:crypto";
import { ApiError } from "./http.js";
import { invalid } from "./validate.js";

const SIGNATURES = [
  { mime: "application/pdf", ext: "pdf", test: b => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d },
  { mime: "image/jpeg", ext: "jpg", test: b => b.length > 2 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", test: b => b.length > 7 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, i) => b[i] === value) },
  { mime: "image/webp", ext: "webp", test: b => b.length > 11 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP" },
];

export function sniffFile(bytes) {
  return SIGNATURES.find(signature => signature.test(bytes)) ?? null;
}

// Reads a multipart/form-data request: `file` plus the allowed text fields.
export async function readUpload(request, fields, rules) {
  const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (type !== "multipart/form-data") {
    throw new ApiError(415, "invalid_content_type", "Kirim berkas sebagai multipart/form-data.");
  }
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > rules.maxBytes + 64 * 1024) invalid(rules.field, `Berkas harus ${rules.label}.`);
  let form;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError(400, "invalid_form", "Format formulir tidak valid.");
  }
  const values = {};
  for (const [key, value] of form.entries()) {
    if (key === "file") continue;
    if (!fields.includes(key) || typeof value !== "string" || key in values) {
      throw new ApiError(400, "invalid_fields", "Isian permintaan tidak valid.");
    }
    values[key] = value;
  }
  const files = form.getAll("file");
  const file = files[0];
  if (files.length !== 1 || typeof file === "string" || !file || file.size < 1 || file.size > rules.maxBytes) {
    invalid(rules.field, `Unggah satu berkas ${rules.label}.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = sniffFile(bytes);
  if (!signature || !rules.types.includes(signature.mime)) invalid(rules.field, `Berkas harus ${rules.label}.`);
  return {
    values,
    file: {
      bytes, mime: signature.mime, ext: signature.ext, size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  };
}
