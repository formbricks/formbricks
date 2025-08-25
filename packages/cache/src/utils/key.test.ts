import type { CacheKey } from "@/types/keys";
import { describe, expect, test } from "vitest";
import { makeCacheKey } from "./key";

describe("@formbricks/cache utils/key", () => {
  describe("makeCacheKey helper", () => {
    test("should create cache key with automatic fb prefix", () => {
      const key: CacheKey = makeCacheKey("env", "123", "state");
      expect(key).toBe("fb:env:123:state");
      expect(typeof key).toBe("string");
    });

    test("should work with minimum parts", () => {
      const key: CacheKey = makeCacheKey("user", "456");
      expect(key).toBe("fb:user:456");
    });

    test("should work with many parts", () => {
      const key: CacheKey = makeCacheKey("user", "123", "org", "456", "permissions");
      expect(key).toBe("fb:user:123:org:456:permissions");
    });

    test("should throw error if fb prefix is included", () => {
      expect(() => makeCacheKey("fb", "env", "123")).toThrow(
        "Invalid Cache key: Do not include 'fb' prefix, it's added automatically"
      );
    });

    test("should throw error for empty parts", () => {
      expect(() => makeCacheKey("env", "", "state")).toThrow("Invalid Cache key: Parts cannot be empty");

      expect(() => makeCacheKey("", "123")).toThrow("Invalid Cache key: Parts cannot be empty");
    });

    test("should validate structure with regex", () => {
      // Valid structures should pass
      expect(() => makeCacheKey("env", "123")).not.toThrow();
      expect(() => makeCacheKey("env", "123", "state")).not.toThrow();
      expect(() => makeCacheKey("rate_limit", "api", "user", "123")).not.toThrow();
    });

    test("should return branded CacheKey type", () => {
      const key: CacheKey = makeCacheKey("test", "123");

      // Function that only accepts CacheKey
      const acceptsCacheKey = (cacheKey: CacheKey): string => cacheKey;

      // Should work without TypeScript errors
      expect(acceptsCacheKey(key)).toBe("fb:test:123");
    });

    test("should be compatible with existing cache key patterns", () => {
      // Test patterns that match existing createCacheKey outputs
      expect(makeCacheKey("env", "env-123", "state")).toBe("fb:env:env-123:state");
      expect(makeCacheKey("org", "org-456", "billing")).toBe("fb:org:org-456:billing");
      expect(makeCacheKey("license", "org-789", "status")).toBe("fb:license:org-789:status");
      expect(makeCacheKey("rate_limit", "api", "key-123", "endpoint")).toBe(
        "fb:rate_limit:api:key-123:endpoint"
      );
    });
  });
});
