import type { CacheKey } from "@/types/keys";
import { describe, expect, test } from "vitest";
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

      test("should handle special characters in environment IDs", () => {
        const key = createCacheKey.environment.state("env-test_123-special");
        expect(key).toBe("fb:env:env-test_123-special:state");
      });

      test("should throw error for empty environment ID", () => {
        expect(() => createCacheKey.environment.state("")).toThrow(
          "Invalid Cache key: Parts cannot be empty"
        );
      });
    });

    describe("organization namespace", () => {
      test("should create organization billing key", () => {
        const key = createCacheKey.organization.billing("org-123");
        expect(key).toBe("fb:org:org-123:billing");
      });

      test("should handle complex organization IDs", () => {
        const key = createCacheKey.organization.billing("org-enterprise-team_123");
        expect(key).toBe("fb:org:org-enterprise-team_123:billing");
      });

      test("should throw error for empty organization ID", () => {
        expect(() => createCacheKey.organization.billing("")).toThrow(
          "Invalid Cache key: Parts cannot be empty"
        );
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

      test("should handle UUID-style organization IDs", () => {
        const key = createCacheKey.license.status("550e8400-e29b-41d4-a716-446655440000");
        expect(key).toBe("fb:license:550e8400-e29b-41d4-a716-446655440000:status");
      });

      test("should throw error for empty organization ID in license keys", () => {
        expect(() => createCacheKey.license.status("")).toThrow("Invalid Cache key: Parts cannot be empty");
        expect(() => createCacheKey.license.previous_result("")).toThrow(
          "Invalid Cache key: Parts cannot be empty"
        );
      });
    });

    describe("rateLimit namespace", () => {
      test("should create rate limit core key", () => {
        const key = createCacheKey.rateLimit.core("api", "user-123", 1640995200);
        expect(key).toBe("fb:rate_limit:api:user-123:1640995200");
      });

      test("should handle different rate limit namespaces", () => {
        const apiKey = createCacheKey.rateLimit.core("api", "key-abc", 1640995200);
        expect(apiKey).toBe("fb:rate_limit:api:key-abc:1640995200");

        const loginKey = createCacheKey.rateLimit.core("auth:login", "user-456", 1640995300);
        expect(loginKey).toBe("fb:rate_limit:auth:login:user-456:1640995300");
      });

      test("should convert window start number to string", () => {
        const key = createCacheKey.rateLimit.core("webhook", "endpoint-789", 0);
        expect(key).toBe("fb:rate_limit:webhook:endpoint-789:0");
      });

      test("should throw error for empty parameters", () => {
        expect(() => createCacheKey.rateLimit.core("", "user-123", 1640995200)).toThrow(
          "Invalid Cache key: Parts cannot be empty"
        );
        expect(() => createCacheKey.rateLimit.core("api", "", 1640995200)).toThrow(
          "Invalid Cache key: Parts cannot be empty"
        );
      });
    });

    describe("custom namespace", () => {
      test("should create custom key with subResource", () => {
        const key = createCacheKey.custom("analytics", "user-456", "daily-stats");
        expect(key).toBe("fb:analytics:user-456:daily-stats");
      });

      test("should create custom key without subResource", () => {
        const key = createCacheKey.custom("analytics", "user-789");
        expect(key).toBe("fb:analytics:user-789");
      });

      test("should handle complex subResources", () => {
        const key = createCacheKey.custom("analytics", "user-123", "dashboard:metrics:daily");
        expect(key).toBe("fb:analytics:user-123:dashboard:metrics:daily");
      });

      test("should restrict to valid namespaces only", () => {
        // TypeScript should prevent invalid namespaces at compile time
        // Test with currently valid namespace
        const key = createCacheKey.custom("analytics", "test-id");
        expect(key).toBe("fb:analytics:test-id");
      });

      test("should throw error for empty identifier", () => {
        expect(() => createCacheKey.custom("analytics", "")).toThrow(
          "Invalid Cache key: Parts cannot be empty"
        );
      });

      test("should throw error for empty subResource when provided", () => {
        expect(() => createCacheKey.custom("analytics", "user-123", "")).toThrow(
          "Invalid Cache key: Parts cannot be empty"
        );
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
        createCacheKey.environment.config("env-1"),
        createCacheKey.environment.segments("env-1"),
        createCacheKey.organization.billing("org-1"),
        createCacheKey.license.status("org-1"),
        createCacheKey.license.previous_result("org-1"),
        createCacheKey.rateLimit.core("api", "user-1", 123456),
        createCacheKey.custom("analytics", "temp-1"),
        createCacheKey.custom("analytics", "temp-1", "sub"),
      ];

      keys.forEach((key) => {
        expect(typeof key).toBe("string");
        expect(key.startsWith("fb:")).toBe(true);
      });
    });
  });

  describe("validation and error handling", () => {
    test("should validate all cache key structures", () => {
      // All generated keys should follow the fb:resource:identifier[:subresource] pattern
      const keys = [
        createCacheKey.environment.state("env-123"),
        createCacheKey.organization.billing("org-456"),
        createCacheKey.license.status("license-789"),
        createCacheKey.rateLimit.core("api", "user-101", 1640995200),
        createCacheKey.custom("analytics", "analytics-102", "daily"),
      ];

      keys.forEach((key) => {
        // Should match the expected pattern: fb:resource:identifier[:subresource]*
        expect(key).toMatch(/^fb:(?:[^:]+)(?::[^:]+)+$/);
        expect(key.split(":").length).toBeGreaterThanOrEqual(3);
      });
    });

    test("should throw consistent error messages for empty parts", () => {
      const errorMessage = "Invalid Cache key: Parts cannot be empty";

      expect(() => createCacheKey.environment.state("")).toThrow(errorMessage);
      expect(() => createCacheKey.organization.billing("")).toThrow(errorMessage);
      expect(() => createCacheKey.license.status("")).toThrow(errorMessage);
      expect(() => createCacheKey.rateLimit.core("", "user", 123)).toThrow(errorMessage);
      expect(() => createCacheKey.custom("analytics", "")).toThrow(errorMessage);
    });

    test("should handle edge case values safely", () => {
      // Test with realistic edge case values
      const specialChars = createCacheKey.environment.state("env_test-123.special");
      expect(specialChars).toBe("fb:env:env_test-123.special:state");

      const numeric = createCacheKey.organization.billing("12345");
      expect(numeric).toBe("fb:org:12345:billing");

      const longId = createCacheKey.license.status("very-long-organization-identifier-that-might-exist");
      expect(longId).toBe("fb:license:very-long-organization-identifier-that-might-exist:status");
    });
  });
});
