export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const privateHeaders = { "Cache-Control": "private, no-store" };

export function apiRoute(authenticate, handler, status = 200) {
  return async (request, routeContext) => {
    try {
      if (!["GET", "HEAD"].includes(request.method)) {
        const origin = request.headers.get("origin");
        if (origin && origin !== new URL(request.url).origin) {
          throw new ApiError(403, "invalid_origin", "Permintaan dari situs lain tidak diizinkan.");
        }
      }
      const context = await authenticate(request);
      const data = await handler(context, request, routeContext);
      return Response.json(data, { status, headers: privateHeaders });
    } catch (error) {
      const known = error instanceof ApiError;
      return Response.json({
        code: known ? error.code : "internal_error",
        error: known ? error.message : "Permintaan belum dapat diproses. Coba lagi beberapa saat.",
      }, { status: known ? error.status : 500, headers: privateHeaders });
    }
  };
}

export function makeAuthenticate({ cookieClient, bearerClient }) {
  return async request => {
    const authorization = request.headers.get("authorization");
    const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (authorization && !token) throw new ApiError(401, "not_authenticated", "Token sesi tidak valid.");
    const supabase = token ? await bearerClient(token) : await cookieClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      throw new ApiError(401, "not_authenticated", "Sesi login berakhir. Masuk kembali lalu coba lagi.");
    }
    return { supabase, user: data.user };
  };
}

export async function readObject(request, fields) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new ApiError(415, "invalid_content_type", "Kirim data dalam format JSON.");
  }
  let body;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Format JSON tidak valid.");
  }
  if (!body || Array.isArray(body) || typeof body !== "object" || Object.keys(body).some(key => !fields.includes(key))) {
    throw new ApiError(400, "invalid_fields", "Isian permintaan tidak valid.");
  }
  return body;
}
