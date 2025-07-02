import redis from "@/modules/cache/redis";
import { ZRateLimitConfig } from "@/modules/core/rate-limit/types/rate-limit";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { applyRateLimit } from "./helpers";
import { checkRateLimit } from "./rate-limit";
import { rateLimitConfigs } from "./rate-limit-configs";

// Mock dependencies for integration tests
vi.mock("@/lib/constants", () => ({
  REDIS_URL: "redis://localhost:6379",
  RATE_LIMITING_DISABLED: false,
  SENTRY_DSN: "https://test@sentry.io/test",
}));

vi.mock("@/modules/cache/redis", () => ({
  default: {
    eval: vi.fn(),
  },
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
  const mockRedis = redis as any;

  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(apiConfigs).toEqual(["v1", "v2", "client"]);
    });

    test("should have all action configurations", () => {
      const actionConfigs = Object.keys(rateLimitConfigs.actions);
      expect(actionConfigs).toEqual(["profileUpdate", "surveyFollowUp"]);
    });
  });

  describe("Zod Validation", () => {
    test("all configurations should pass Zod validation", () => {
      const allConfigs = [
        ...Object.values(rateLimitConfigs.auth),
        ...Object.values(rateLimitConfigs.api),
        ...Object.values(rateLimitConfigs.actions),
      ];

      allConfigs.forEach((config) => {
        expect(() => ZRateLimitConfig.parse(config)).not.toThrow();
      });
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
      mockRedis.eval.mockResolvedValue([1, 1]);

      const config = rateLimitConfigs.auth.login;
      const result = await checkRateLimit(config, "test-identifier");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.allowed).toBe(true);
      }
    });

    test("should work with applyRateLimit helper", async () => {
      mockRedis.eval.mockResolvedValue([1, 1]);

      const config = rateLimitConfigs.api.v1;
      await expect(applyRateLimit(config, "api-key-123")).resolves.toBeUndefined();
    });

    test("should enforce limits correctly for each config type", async () => {
      const testCases = [
        { config: rateLimitConfigs.auth.login, identifier: "user-login" },
        { config: rateLimitConfigs.auth.signup, identifier: "user-signup" },
        { config: rateLimitConfigs.api.v1, identifier: "api-v1-key" },
        { config: rateLimitConfigs.api.v2, identifier: "api-v2-key" },
        { config: rateLimitConfigs.actions.profileUpdate, identifier: "user-profile" },
      ];

      const testAllowedRequest = async (config: any, identifier: string) => {
        mockRedis.eval.mockResolvedValueOnce([1, 1]);
        const result = await checkRateLimit(config, identifier);
        expect(result.ok).toBe(true);
        expect((result as any).data.allowed).toBe(true);
      };

      const testExceededLimit = async (config: any, identifier: string) => {
        mockRedis.eval.mockResolvedValueOnce([config.allowedPerInterval + 1, 0]);
        const result = await checkRateLimit(config, identifier);
        expect(result.ok).toBe(true);
        expect((result as any).data.allowed).toBe(false);
      };

      for (const { config, identifier } of testCases) {
        await testAllowedRequest(config, identifier);
        await testExceededLimit(config, identifier);
      }
    });
  });
});
