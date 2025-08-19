import { describe, expect, test } from "vitest";
import type { CacheKey } from "../types/keys";
import { createCacheKey } from "./cache-keys";

describe("@formbricks/cache cacheKeys", () => {
  describe("createCacheKey", () => {
    describe("environment namespace", () => {
      test("should create environment state key", () => {
        const key = createCacheKey.environment.state("env-123");
        expect(key).toBe("fb:env:env-123:state");
        // Verify it returns branded CacheKey type
        expect(typeof key).toBe("string");
      });

      test("should create environment config key", () => {
        const key = createCacheKey.environment.config("env-abc");
        expect(key).toBe("fb:env:env-abc:config");
      });

      test("should create environment segments key", () => {
        const key = createCacheKey.environment.segments("env-def");
        expect(key).toBe("fb:env:env-def:segments");
      });
    });

    describe("organization namespace", () => {
      test("should create organization billing key", () => {
        const key = createCacheKey.organization.billing("org-123");
        expect(key).toBe("fb:org:org-123:billing");
      });
    });

    describe("license namespace", () => {
      test("should create license status key", () => {
        const key = createCacheKey.license.status("org-123");
        expect(key).toBe("fb:license:org-123:status");
      });

      test("should create license previous_result key", () => {
        const key = createCacheKey.license.previous_result("org-def");
        expect(key).toBe("fb:license:org-def:previous_result");
      });
    });

    describe("rateLimit namespace", () => {
      test("should create rate limit core key", () => {
        const key = createCacheKey.rateLimit.core("api", "user-123", 1640995200);
        expect(key).toBe("fb:rate_limit:api:user-123:1640995200");
      });
    });

    describe("custom namespace", () => {
      test("should create custom key with subResource", () => {
        const key = createCacheKey.custom("analytics", "user-456", "daily-stats");
        expect(key).toBe("fb:analytics:user-456:daily-stats");
      });

      test("should restrict to valid namespaces only", () => {
        // TypeScript should prevent this at compile time
        // but let's test the runtime behavior would work correctly
        const validNamespaces = ["analytics"] as const;

        validNamespaces.forEach((namespace) => {
          const key = createCacheKey.custom(namespace, "test-id");
          expect(key).toBe(`fb:${namespace}:test-id`);
        });
      });
    });
  });

  describe("CacheKey type safety", () => {
    test("should return CacheKey branded type", () => {
      const key = createCacheKey.environment.state("test-env");

      // This function would only accept CacheKey, not raw string
      const acceptsCacheKey = (cacheKey: CacheKey): string => cacheKey;

      // This should work without TypeScript errors
      expect(acceptsCacheKey(key)).toBe("fb:env:test-env:state");

      // Raw string would not be accepted (TypeScript compile-time check)
      // acceptsCacheKey("fb:env:test:state"); // This would cause TS error
    });

    test("should work with all namespace keys", () => {
      const keys = [
        createCacheKey.environment.state("env-1"),
        createCacheKey.organization.billing("org-1"),
        createCacheKey.license.status("org-1"),
        createCacheKey.custom("analytics", "temp-1"),
      ];

      keys.forEach((key) => {
        expect(typeof key).toBe("string");
      });
    });
  });
});
