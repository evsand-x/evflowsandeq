import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import Redis from "ioredis";

const windowSeconds = 60;
const incrementWithExpiry = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
  return count
`;

export function createAuthRateLimit(redisUrl: string, redisClient?: Redis) {
  const redis = redisClient ?? new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  const middleware = async (request: Request, response: Response, next: NextFunction) => {
    const action = request.path.endsWith("/login") ? "login" : "refresh";
    const limit = action === "login" ? 10 : 30;
    const identity = createHash("sha256")
      .update(request.ip ?? request.socket.remoteAddress ?? "unknown")
      .digest("hex");
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `evflow:auth-rate:${action}:${identity}:${bucket}`;
    try {
      const count = Number(await redis.eval(incrementWithExpiry, 1, key, windowSeconds + 1));
      if (count > limit) {
        response.setHeader("Retry-After", String(windowSeconds));
        response.status(429).json({
          type: "urn:evflow:problem:too-many-requests",
          title: "TOO_MANY_REQUESTS",
          status: 429,
          detail: "Terlalu banyak percobaan. Coba lagi nanti.",
        });
        return;
      }
      next();
    } catch {
      response.status(503).json({
        type: "urn:evflow:problem:service-unavailable",
        title: "SERVICE_UNAVAILABLE",
        status: 503,
        detail: "Layanan autentikasi sementara tidak tersedia.",
      });
    }
  };
  return { middleware, close: () => redis.quit() };
}
