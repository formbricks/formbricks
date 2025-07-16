// Import modules after mocking
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
// Import after mocking
import { checkRateLimit } from "./rate-limit";
import { TRateLimitConfig } from "./types/rate-limit";

const { mockEval, mockRedisClient, mockGetRedisClient } = vi.hoisted(() => {
  const _mockEval = vi.fn();
  const _mockRedisClient = {
    eval: _mockEval,
  } as any;

  const _mockGetRedisClient = vi.fn().mockReturnValue(_mockRedisClient);

  return {
    mockEval: _mockEval,
    mockRedisClient: _mockRedisClient,
    mockGetRedisClient: _mockGetRedisClient,
  };
});

// Mock all dependencies (will use the hoisted mocks above)
vi.mock("@/modules/cache/redis", () => ({
  getRedisClient: mockGetRedisClient,
}));

vi.mock("@/lib/constants", () => ({
  REDIS_URL: "redis://localhost:6379",
  RATE_LIMITING_DISABLED: false,
  SENTRY_DSN: "https://test@sentry.io/test",
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

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock to return our mock client
    mockGetRedisClient.mockReturnValue(mockRedisClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Ensure mocks don't leak to other test suites (e.g. load tests)
  afterAll(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  test("should allow request when under limit", async () => {
    // Mock Redis returning count of 2, which is under limit of 5
    mockEval.mockResolvedValue([2, 1]);

    const result = await checkRateLimit(testConfig, "test-user");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.allowed).toBe(true);
    }
  });

  test("should deny request when over limit", async () => {
    // Mock Redis returning count of 6, which is over limit of 5
    mockEval.mockResolvedValue([6, 0]);

    const result = await checkRateLimit(testConfig, "test-user");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.allowed).toBe(false);
    }
  });

  test("should fail open when Redis is unavailable", async () => {
    // Mock Redis throwing an error
    mockEval.mockRejectedValue(new Error("Redis connection failed"));

    const result = await checkRateLimit(testConfig, "test-user");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.allowed).toBe(true);
    }
  });

  test("should fail open when rate limiting is disabled", async () => {
    vi.resetModules();
    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "redis://localhost:6379",
      RATE_LIMITING_DISABLED: true,
      SENTRY_DSN: "https://test@sentry.io/test",
    }));

    // Dynamic import after mocking
    const { checkRateLimit: checkRateLimitMocked } = await import("./rate-limit");
    const result = await checkRateLimitMocked(testConfig, "test-user");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.allowed).toBe(true);
    }
  });

  test("should fail open when Redis is not configured", async () => {
    vi.resetModules();
    vi.doMock("@/modules/cache/redis", () => ({
      getRedisClient: vi.fn().mockReturnValue(null),
    }));

    // Dynamic import after mocking
    const { checkRateLimit: checkRateLimitMocked } = await import("./rate-limit");
    const result = await checkRateLimitMocked(testConfig, "test-user");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.allowed).toBe(true);
    }
  });

  test("should generate correct Redis key with window alignment", async () => {
    mockEval.mockResolvedValue([1, 1]);

    await checkRateLimit(testConfig, "test-user");

    expect(mockEval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('INCR', key)"),
      expect.objectContaining({
        keys: [expect.stringMatching(/^fb:rate_limit:test:test-user:\d+$/)],
        arguments: ["5", expect.any(String)],
      })
    );
  });

  test("should use provided namespace", async () => {
    const configWithCustomNamespace: TRateLimitConfig = {
      interval: 300,
      allowedPerInterval: 5,
      namespace: "custom",
    };

    mockEval.mockResolvedValue([1, 1]);

    await checkRateLimit(configWithCustomNamespace, "test-user");

    expect(mockEval).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        keys: [expect.stringMatching(/^fb:rate_limit:custom:test-user:\d+$/)],
        arguments: ["5", expect.any(String)],
      })
    );
  });

  test("should calculate correct TTL for window expiration", async () => {
    mockEval.mockResolvedValue([1, 1]);

    await checkRateLimit(testConfig, "test-user");

    // TTL should be between 0 and 300 seconds (window interval)
    const ttlUsed = Number.parseInt(mockEval.mock.calls[0][1].arguments[1]);
    expect(ttlUsed).toBeGreaterThan(0);
    expect(ttlUsed).toBeLessThanOrEqual(300);
  });

  test("should set TTL only on first increment", async () => {
    mockEval.mockResolvedValue([1, 1]);

    await checkRateLimit(testConfig, "test-user");

    // Verify the Lua script contains the conditional TTL logic
    const luaScript = mockEval.mock.calls[0][0];
    expect(luaScript).toContain("if current == 1 then");
    expect(luaScript).toContain("redis.call('EXPIRE', key, ttl)");
    expect(luaScript).toContain("end");

    // Verify script structure for atomic increment and conditional expire
    expect(luaScript).toContain("redis.call('INCR', key)");
    expect(luaScript).toContain("return {current, current <= limit and 1 or 0}");
  });

  test("should not call Sentry when SENTRY_DSN is not configured", async () => {
    vi.resetModules();

    // Re-mock all dependencies after resetModules
    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "redis://localhost:6379",
      RATE_LIMITING_DISABLED: false,
      SENTRY_DSN: undefined,
    }));

    const mockAddBreadcrumb = vi.fn();
    const mockCaptureException = vi.fn();
    vi.doMock("@sentry/nextjs", () => ({
      addBreadcrumb: mockAddBreadcrumb,
      captureException: mockCaptureException,
    }));

    vi.doMock("@formbricks/logger", () => ({
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    }));

    vi.doMock("@/modules/cache/redis", () => ({
      getRedisClient: vi.fn().mockReturnValue({
        eval: vi.fn().mockResolvedValue([6, 0]),
      }),
    }));

    // Dynamic import after mocking
    const { checkRateLimit: checkRateLimitMocked } = await import("./rate-limit");

    await checkRateLimitMocked(testConfig, "test-user");

    // Verify Sentry functions were not called
    expect(mockAddBreadcrumb).not.toHaveBeenCalled();
  });

  test("should call Sentry when SENTRY_DSN is configured and rate limit exceeded", async () => {
    vi.resetModules();

    // Re-mock all dependencies after resetModules
    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "redis://localhost:6379",
      RATE_LIMITING_DISABLED: false,
      SENTRY_DSN: "https://test@sentry.io/test",
    }));

    const mockAddBreadcrumb = vi.fn();
    const mockCaptureException = vi.fn();
    vi.doMock("@sentry/nextjs", () => ({
      addBreadcrumb: mockAddBreadcrumb,
      captureException: mockCaptureException,
    }));

    vi.doMock("@formbricks/logger", () => ({
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    }));

    vi.doMock("@/modules/cache/redis", () => ({
      getRedisClient: vi.fn().mockReturnValue({
        eval: vi.fn().mockResolvedValue([6, 0]),
      }),
    }));

    // Dynamic import after mocking
    const { checkRateLimit: checkRateLimitMocked } = await import("./rate-limit");

    await checkRateLimitMocked(testConfig, "test-user");

    // Verify Sentry breadcrumb was added
    expect(mockAddBreadcrumb).toHaveBeenCalledWith({
      message: "Rate limit exceeded",
      level: "warning",
      data: expect.objectContaining({
        identifier: "test-user",
        currentCount: 6,
        limit: 5,
        namespace: "test",
      }),
    });
  });

  test("should call Sentry when SENTRY_DSN is configured and Redis error occurs", async () => {
    vi.resetModules();

    // Re-mock all dependencies after resetModules
    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "redis://localhost:6379",
      RATE_LIMITING_DISABLED: false,
      SENTRY_DSN: "https://test@sentry.io/test",
    }));

    const mockAddBreadcrumb = vi.fn();
    const mockCaptureException = vi.fn();
    vi.doMock("@sentry/nextjs", () => ({
      addBreadcrumb: mockAddBreadcrumb,
      captureException: mockCaptureException,
    }));

    vi.doMock("@formbricks/logger", () => ({
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    }));

    const redisError = new Error("Redis connection failed");
    vi.doMock("@/modules/cache/redis", () => ({
      getRedisClient: vi.fn().mockReturnValue({
        eval: vi.fn().mockRejectedValue(redisError),
      }),
    }));

    // Dynamic import after mocking
    const { checkRateLimit: checkRateLimitMocked } = await import("./rate-limit");

    await checkRateLimitMocked(testConfig, "test-user");

    // Verify Sentry exception was captured
    expect(mockCaptureException).toHaveBeenCalledWith(
      redisError,
      expect.objectContaining({
        tags: {
          component: "rate-limiter",
          namespace: "test",
        },
        extra: expect.objectContaining({
          error: redisError,
          identifier: "test-user",
          namespace: "test",
        }),
      })
    );
  });
});
