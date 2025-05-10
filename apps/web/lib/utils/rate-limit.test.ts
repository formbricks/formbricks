import { beforeEach, describe, expect, test, vi } from "vitest";

describe("in-memory rate limiter", () => {
  test("allows requests within limit and throws after limit", async () => {
    const { rateLimit } = await import("./rate-limit");
    const limiterFn = rateLimit({ interval: 1, allowedPerInterval: 2 });
    await expect(limiterFn("a")).resolves.toBeUndefined();
    await expect(limiterFn("a")).resolves.toBeUndefined();
    await expect(limiterFn("a")).rejects.toThrow("Rate limit exceeded");
  });

  test("separate tokens have separate counts", async () => {
    const { rateLimit } = await import("./rate-limit");
    const limiterFn = rateLimit({ interval: 1, allowedPerInterval: 2 });
    await expect(limiterFn("x")).resolves.toBeUndefined();
    await expect(limiterFn("y")).resolves.toBeUndefined();
    await expect(limiterFn("x")).resolves.toBeUndefined();
    await expect(limiterFn("y")).resolves.toBeUndefined();
  });
});

describe("redis rate limiter", () => {
  beforeEach(async () => {
    vi.resetModules();
    const constants = await vi.importActual("@/lib/constants");
    vi.doMock("@/lib/constants", () => ({
      ...constants,
      REDIS_HTTP_URL: "http://redis",
    }));
  });

  test("sets expire on first use and does not throw", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ INCR: 1 }) })
      .mockResolvedValueOnce({ ok: true });
    const { rateLimit } = await import("./rate-limit");
    const limiter = rateLimit({ interval: 10, allowedPerInterval: 2 });
    await expect(limiter("t")).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith("http://redis/INCR/t");
    expect(fetch).toHaveBeenCalledWith("http://redis/EXPIRE/t/10");
  });

  test("does not throw when redis INCR response not ok", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false });
    const { rateLimit } = await import("./rate-limit");
    const limiter = rateLimit({ interval: 10, allowedPerInterval: 2 });
    await expect(limiter("t")).resolves.toBeUndefined();
  });

  test("throws when INCR exceeds limit", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ INCR: 3 }) });
    const { rateLimit } = await import("./rate-limit");
    const limiter = rateLimit({ interval: 10, allowedPerInterval: 2 });
    await expect(limiter("t")).rejects.toThrow("Rate limit exceeded for IP: t");
  });
});
