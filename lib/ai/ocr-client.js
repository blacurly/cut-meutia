// Client for the OCR service (separate repository ayomi-ocr-api, deployed on
// Dokploy). It reads a PDF/JPG/PNG and returns the text of every page; the
// web app never runs OCR itself. Server-only env vars: OCR_API_URL and
// OCR_API_TOKEN (never NEXT_PUBLIC_).
import { AiError, providerError } from "./errors.js";

const TIMEOUT_MS = 180_000; // a 20-page scan takes ~1–2 minutes on the server

// The document itself cannot be read (corrupt, encrypted, too many pages).
export class OcrRejectedError extends Error {
  constructor(message) {
    super(message || "Dokumen tidak dapat dibaca oleh OCR.");
    this.status = 422;
    this.code = "document_unreadable";
  }
}

export function ocrConfigured(env = process.env) {
  return Boolean(env.OCR_API_URL?.trim() && env.OCR_API_TOKEN?.trim());
}

export async function readDocumentText(bytes, { mimeType, fileName = "dokumen", fetchImpl = fetch, env = process.env } = {}) {
  const url = env.OCR_API_URL?.trim().replace(/\/+$/, "");
  const token = env.OCR_API_TOKEN?.trim();
  if (!url || !token) throw new AiError("MODEL_UNAVAILABLE", "OCR_API_URL atau OCR_API_TOKEN belum diatur.");
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mimeType }), fileName);
  let response;
  try {
    response = await fetchImpl(`${url}/ocr`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new AiError(error?.name === "TimeoutError" ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE");
  }
  const payload = await response.json().catch(() => null);
  if (response.ok) {
    if (!Array.isArray(payload?.pages) || payload.pages.some(page => typeof page?.text !== "string" || !Number.isInteger(page?.page))) {
      throw new AiError("OUTPUT_INVALID", "Jawaban OCR tidak sesuai format.");
    }
    return payload;
  }
  if ([400, 413, 415].includes(response.status)) throw new OcrRejectedError(payload?.detail?.error);
  throw providerError(response.status, `OCR HTTP ${response.status}`);
}
