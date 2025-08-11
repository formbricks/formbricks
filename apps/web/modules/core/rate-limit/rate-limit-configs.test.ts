import { ZRateLimitConfig } from "@/modules/core/rate-limit/types/rate-limit";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { applyRateLimit } from "./helpers";
import { checkRateLimit } from "./rate-limit";
import { rateLimitConfigs } from "./rate-limit-configs";

const { mockEval, mockRedisClient, mockGetRedisClient } = vi.hoisted(() => {
  const _mockEval = vi.fn();
  const _mockRedisClient = { eval: _mockEval } as any;
  const _mockGetRedisClient = vi.fn().mockReturnValue(_mockRedisClient);
  return { mockEval: _mockEval, mockRedisClient: _mockRedisClient, mockGetRedisClient: _mockGetRedisClient };
});

// Mock dependencies for integration tests
vi.mock("@/lib/constants", () => ({
  REDIS_URL: "redis://localhost:6379",
  RATE_LIMITING_DISABLED: false,
  SENTRY_DSN: "https://test@sentry.io/test",
}));

vi.mock("@/modules/cache/redis", () => ({
  getRedisClient: mockGetRedisClient,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/modules/cache/lib/cacheKeys", () => ({
  createCacheKey: {
    rateLimit: {
      core: vi.fn(
        (namespace, identifier, windowStart) => `fb:rate_limit:${namespace}:${identifier}:${windowStart}`
      ),
    },
  },
}));

describe("rateLimitConfigs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock to return our mock client
    mockGetRedisClient.mockReturnValue(mockRedisClient);
  });

  describe("Configuration Structure", () => {
    test("should have all required config groups", () => {
      expect(rateLimitConfigs).toHaveProperty("auth");
      expect(rateLimitConfigs).toHaveProperty("api");
      expect(rateLimitConfigs).toHaveProperty("actions");
    });

    test("should have all auth configurations", () => {
      const authConfigs = Object.keys(rateLimitConfigs.auth);
      expect(authConfigs).toEqual(["login", "signup", "forgotPassword", "verifyEmail"]);
    });

    test("should have all API configurations", () => {
      const apiConfigs = Object.keys(rateLimitConfigs.api);
      expect(apiConfigs).toEqual(["v1", "v2", "client", "syncUserIdentification"]);
    });

    test("should have all action configurations", () => {
      const actionConfigs = Object.keys(rateLimitConfigs.actions);
      expect(actionConfigs).toEqual(["emailUpdate", "surveyFollowUp"]);
    });
  });

  describe("Zod Validation", () => {
    test("all configurations should pass Zod validation", () => {
      const allConfigs = [
        ...Object.values(rateLimitConfigs.auth),
        ...Object.values(rateLimitConfigs.api),
        ...Object.values(rateLimitConfigs.actions),
      ];

      for (const config of allConfigs) {
        expect(() => ZRateLimitConfig.parse(config)).not.toThrow();
      }
    });
  });

  describe("Configuration Logic", () => {
    test("all namespaces should be unique", () => {
      const allNamespaces: string[] = [];

      // Collect all namespaces
      Object.values(rateLimitConfigs.auth).forEach((config) => allNamespaces.push(config.namespace));
      Object.values(rateLimitConfigs.api).forEach((config) => allNamespaces.push(config.namespace));
      Object.values(rateLimitConfigs.actions).forEach((config) => allNamespaces.push(config.namespace));

      const uniqueNamespaces = new Set(allNamespaces);
      expect(uniqueNamespaces.size).toBe(allNamespaces.length);
    });
  });

  describe("Integration with Rate Limiting", () => {
    test("should work with checkRateLimit function", async () => {
      mockEval.mockResolvedValue([1, 1]);

      const config = rateLimitConfigs.auth.login;
      const result = await checkRateLimit(config, "test-identifier");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.allowed).toBe(true);
      }
    });

    test("should work with applyRateLimit helper", async () => {
      mockEval.mockResolvedValue([1, 1]);

      const config = rateLimitConfigs.api.v1;
      await expect(applyRateLimit(config, "api-key-123")).resolves.toBeUndefined();
    });

    test("should enforce limits correctly for each config type", async () => {
      const testCases = [
        { config: rateLimitConfigs.auth.login, identifier: "user-login" },
        { config: rateLimitConfigs.auth.signup, identifier: "user-signup" },
        { config: rateLimitConfigs.api.v1, identifier: "api-v1-key" },
        { config: rateLimitConfigs.api.v2, identifier: "api-v2-key" },
        { config: rateLimitConfigs.api.client, identifier: "client-api-key" },
        { config: rateLimitConfigs.api.syncUserIdentification, identifier: "sync-user-id" },
        { config: rateLimitConfigs.actions.emailUpdate, identifier: "user-profile" },
      ];

      for (const { config, identifier } of testCases) {
        // Test allowed request
        mockEval.mockClear();
        mockEval.mockResolvedValue([1, 1]);
        const allowedResult = await checkRateLimit(config, identifier);
        expect(allowedResult.ok).toBe(true);
        expect((allowedResult as any).data.allowed).toBe(true);

        // Test exceeded limit
        mockEval.mockClear();
        mockEval.mockResolvedValue([config.allowedPerInterval + 1, 0]);
        const exceededResult = await checkRateLimit(config, identifier);
        expect(exceededResult.ok).toBe(true);
        expect((exceededResult as any).data.allowed).toBe(false);
      }
    });

    test("should properly configure syncUserIdentification rate limit", async () => {
      const config = rateLimitConfigs.api.syncUserIdentification;

      // Verify configuration values
      expect(config.interval).toBe(60); // 1 minute
      expect(config.allowedPerInterval).toBe(5); // 5 requests per minute
      expect(config.namespace).toBe("api:sync-user-identification");

      // Test with allowed request
      mockEval.mockResolvedValue([1, 1]); // 1 request used, allowed (1 = true)
      const allowedResult = await checkRateLimit(config, "env-user-123");
      expect(allowedResult.ok).toBe(true);
      if (allowedResult.ok) {
        expect(allowedResult.data.allowed).toBe(true);
      }

      // Test when limit is exceeded
      mockEval.mockResolvedValue([6, 0]); // 6 requests used (exceeds limit of 5), not allowed (0 = false)
      const exceededResult = await checkRateLimit(config, "env-user-123");
      expect(exceededResult.ok).toBe(true);
      if (exceededResult.ok) {
        expect(exceededResult.data.allowed).toBe(false);
      }
    });
  });
});
