// Small fixed-window limiter for AI endpoints (Technical Requirement:
// "pembatasan penggunaan"). State is per server instance, so on Vercel it is
// a first line of defence only; a shared store (database/KV) is needed for a
// hard global limit.
const windows = new Map();

export function takeToken(key, { limit = 10, windowMs = 60_000, now = Date.now() } = {}) {
  const current = windows.get(key);
  if (!current || now >= current.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
  if (current.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
  }
  current.count += 1;
  return { allowed: true, remaining: limit - current.count, retryAfterSeconds: 0 };
}

export const resetRateLimits = () => windows.clear();
