import type { NextFunction, Request, Response } from "express";
import type Redis from "ioredis";
import { createAuthRateLimit } from "../src/auth-rate-limit";

describe("authentication rate limit", () => {
  it("limits login attempts by source and fails closed if Redis is unavailable", async () => {
    const counts = new Map<string, number>();
    let unavailable = false;
    const redis = {
      eval: async (_script: string, _keys: number, key: string) => {
        if (unavailable) throw new Error("Redis unavailable");
        const count = (counts.get(key) ?? 0) + 1;
        counts.set(key, count);
        return count;
      },
      quit: async () => "OK",
    } as unknown as Redis;
    const limiter = createAuthRateLimit("redis://unused", redis);
    const invoke = async (ip: string) => {
      let status = 200;
      let nextCalled = false;
      const response = {
        setHeader: () => undefined,
        status: (value: number) => {
          status = value;
          return response;
        },
        json: () => response,
      } as unknown as Response;
      await limiter.middleware({ path: "/login", ip } as Request, response, (() => {
        nextCalled = true;
      }) as NextFunction);
      return { status, nextCalled };
    };
    for (let index = 0; index < 10; index++)
      expect(await invoke("192.0.2.1")).toEqual({ status: 200, nextCalled: true });
    expect(await invoke("192.0.2.1")).toEqual({ status: 429, nextCalled: false });
    expect(await invoke("192.0.2.2")).toEqual({ status: 200, nextCalled: true });
    unavailable = true;
    expect(await invoke("192.0.2.2")).toEqual({ status: 503, nextCalled: false });
  });
});
