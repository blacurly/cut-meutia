// Fixed AI error codes (docs/keputusan-mvp-dan-kontrak-ai-v1.md 5.2).
// `retryable` follows the contract: only timeouts, dropped connections,
// 429 and 5xx are retried automatically, at most 3 attempts in total.
export const AI_ERRORS = {
  INPUT_INVALID: { status: 400, retryable: false, message: "Data untuk AI tidak valid." },
  ACCESS_DENIED: { status: 403, retryable: false, message: "Anda tidak memiliki akses ke fitur AI ini." },
  CONSENT_REQUIRED: { status: 403, retryable: false, message: "Persetujuan pemrosesan AI belum diberikan." },
  PROVIDER_AUTH: { status: 502, retryable: false, message: "Layanan AI belum dikonfigurasi dengan benar." },
  MODEL_UNAVAILABLE: { status: 503, retryable: false, message: "Model AI belum tersedia." },
  RATE_LIMITED: { status: 429, retryable: true, message: "Permintaan AI terlalu banyak. Coba lagi sebentar lagi." },
  PROVIDER_TIMEOUT: { status: 504, retryable: true, message: "Layanan AI terlalu lama merespons." },
  PROVIDER_UNAVAILABLE: { status: 503, retryable: true, message: "Layanan AI sedang tidak tersedia." },
  SAFETY_BLOCKED: { status: 422, retryable: false, message: "Permintaan diblokir oleh pengaman model." },
  OUTPUT_INVALID: { status: 502, retryable: false, message: "Hasil AI tidak sesuai format dan tidak dipakai." },
  EVIDENCE_MISMATCH: { status: 422, retryable: false, message: "Hasil AI tidak didukung data sumber dan tidak dipakai." },
  WORKER_LOST: { status: 500, retryable: true, message: "Proses AI terhenti. Coba lagi." },
  SOURCE_CHANGED: { status: 409, retryable: false, message: "Data sumber berubah saat AI berjalan." },
  CANCELLED_BY_USER: { status: 409, retryable: false, message: "Proses AI dibatalkan." },
};

export class AiError extends Error {
  constructor(code, detail) {
    super(AI_ERRORS[code]?.message ?? "Proses AI gagal.");
    this.code = Object.hasOwn(AI_ERRORS, code) ? code : "PROVIDER_UNAVAILABLE";
    this.detail = detail;
  }
  get retryable() { return AI_ERRORS[this.code].retryable; }
  get status() { return AI_ERRORS[this.code].status; }
}

// HTTP status from a provider -> contract code.
export function providerError(status, detail) {
  if (status === 401 || status === 403) return new AiError("PROVIDER_AUTH", detail);
  if (status === 404) return new AiError("MODEL_UNAVAILABLE", detail);
  if (status === 408) return new AiError("PROVIDER_TIMEOUT", detail);
  if (status === 429) return new AiError("RATE_LIMITED", detail);
  if (status >= 500) return new AiError("PROVIDER_UNAVAILABLE", detail);
  return new AiError("INPUT_INVALID", detail);
}
