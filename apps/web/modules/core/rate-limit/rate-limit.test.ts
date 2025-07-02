// Import modules after mocking
import redis from "@/modules/cache/redis";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { checkRateLimit } from "./rate-limit";
import { TRateLimitConfig } from "./types/rate-limit";

// Mock all dependencies
vi.mock("@/modules/cache/redis");
vi.mock("@/lib/constants", () => ({
  REDIS_URL: "redis://localhost:6379",
  RATE_LIMITING_DISABLED: false,
}));
vi.mock("@formbricks/logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
}));

describe("checkRateLimit", () => {
  const testConfig: TRateLimitConfig = {
    interval: 300, // 5 minutes
    allowedPerInterval: 5,
    namespace: "test",
  };

  const mockRedis = redis as any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Redis mock
    mockRedis.eval = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("should allow request when under limit", async () => {
    // Mock Redis returning count of 2, which is under limit of 5
    mockRedis.eval.mockResolvedValue([2, 1]);

    const result = await checkRateLimit(testConfig, "test-user");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.allowed).toBe(true);
    }
  });

  test("should deny request when over limit", async () => {
    // Mock Redis returning count of 6, which is over limit of 5
    mockRedis.eval.mockResolvedValue([6, 0]);

    const result = await checkRateLimit(testConfig, "test-user");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.allowed).toBe(false);
    }
  });

  test("should fail open when Redis is unavailable", async () => {
    // Mock Redis throwing an error
    mockRedis.eval.mockRejectedValue(new Error("Redis connection failed"));

    const result = await checkRateLimit(testConfig, "test-user");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.allowed).toBe(true);
    }
  });

  test("should fail open when rate limiting is disabled", async () => {
    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "redis://localhost:6379",
      RATE_LIMITING_DISABLED: true,
    }));

    const result = await checkRateLimit(testConfig, "test-user");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.allowed).toBe(true);
    }
  });

  test("should fail open when Redis is not configured", async () => {
    vi.doMock("@/modules/cache/redis", () => ({
      default: null,
    }));

    const result = await checkRateLimit(testConfig, "test-user");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.allowed).toBe(true);
    }
  });

  test("should generate correct Redis key with window alignment", async () => {
    mockRedis.eval.mockResolvedValue([1, 1]);

    await checkRateLimit(testConfig, "test-user");

    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('INCR', key)"),
      1,
      expect.stringMatching(/^fb:rate_limit:test:test-user:\d+$/),
      5,
      expect.any(Number)
    );
  });

  test("should use provided namespace", async () => {
    const configWithCustomNamespace: TRateLimitConfig = {
      interval: 300,
      allowedPerInterval: 5,
      namespace: "custom",
    };

    mockRedis.eval.mockResolvedValue([1, 1]);

    await checkRateLimit(configWithCustomNamespace, "test-user");

    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      expect.stringMatching(/^fb:rate_limit:custom:test-user:\d+$/),
      5,
      expect.any(Number)
    );
  });

  test("should calculate correct TTL for window expiration", async () => {
    mockRedis.eval.mockResolvedValue([1, 1]);

    await checkRateLimit(testConfig, "test-user");

    // TTL should be between 0 and 300 seconds (window interval)
    const ttlUsed = mockRedis.eval.mock.calls[0][4];
    expect(ttlUsed).toBeGreaterThan(0);
    expect(ttlUsed).toBeLessThanOrEqual(300);
  });

  test("should set TTL only on first increment", async () => {
    mockRedis.eval.mockResolvedValue([1, 1]);

    await checkRateLimit(testConfig, "test-user");

    // Verify the Lua script contains the conditional TTL logic
    const luaScript = mockRedis.eval.mock.calls[0][0];
    expect(luaScript).toContain("if current == 1 then");
    expect(luaScript).toContain("redis.call('EXPIRE', key, ttl)");
    expect(luaScript).toContain("end");

    // Verify script structure for atomic increment and conditional expire
    expect(luaScript).toContain("redis.call('INCR', key)");
    expect(luaScript).toContain("return {current, current <= limit and 1 or 0}");
  });
});
