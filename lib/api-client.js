export class ApiRequestError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Server Actions (lib/actions/*) return { ok, ...data } or { ok: false, status,
// code, error }. This turns a failure into the same error requestApi() throws,
// so forms handle both paths the same way.
export function actionResult(result) {
  if (!result?.ok) throw new ApiRequestError(result?.error || "Permintaan gagal.", result?.status, result?.code);
  return result;
}

export async function requestApi(path, { body, ...options } = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...options.headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json();
  if (!response.ok) throw new ApiRequestError(payload.error || "Permintaan gagal.", response.status, payload.code);
  return payload;
}
