/**
 * Simple in-memory sliding-window IP rate limiter
 */
const ipRequests = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  request: Request,
  limit: number = 30,
  windowMs: number = 60 * 1000
): { limited: boolean; remaining: number } {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

  const now = Date.now();
  const entry = ipRequests.get(ip);

  if (!entry || now > entry.resetAt) {
    ipRequests.set(ip, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { limited: true, remaining: 0 };
  }

  entry.count += 1;
  return { limited: false, remaining: limit - entry.count };
}
