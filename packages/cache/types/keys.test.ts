import { describe, expect, test } from "vitest";
import { type CacheKey, type CustomCacheNamespace, ZCacheKey } from "./keys";

describe("@formbricks/cache types/keys", () => {
  describe("ZCacheKey schema", () => {
    test("should validate valid cache keys", () => {
      const validKeys = [
        "fb:test:123:data",
        "fb:env:test:state",
        "analytics:user:123",
        "custom:namespace:key",
      ];

      validKeys.forEach((key) => {
        const result = ZCacheKey.safeParse(key);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(key);
        }
      });
    });

    test("should reject invalid cache keys", () => {
      const invalidKeys = [
        "", // empty string
        "   ", // whitespace only
        "\t", // tab only
        "\n", // newline only
        "  \n  ", // mixed whitespace
      ];

      invalidKeys.forEach((key) => {
        const result = ZCacheKey.safeParse(key);
        expect(result.success).toBe(false);
      });
    });

    test("should provide meaningful error messages", () => {
      const emptyResult = ZCacheKey.safeParse("");
      expect(emptyResult.success).toBe(false);
      if (!emptyResult.success) {
        expect(emptyResult.error.issues[0].message).toBe("Cache key cannot be empty");
      }

      const whitespaceResult = ZCacheKey.safeParse("   ");
      expect(whitespaceResult.success).toBe(false);
      if (!whitespaceResult.success) {
        expect(whitespaceResult.error.issues[0].message).toBe("Cache key cannot be empty or whitespace only");
      }
    });

    test("should create branded CacheKey type", () => {
      const validKey = "fb:test:123:data";
      const result = ZCacheKey.parse(validKey);

      // Type assertion to ensure it's properly branded
      const typedKey: CacheKey = result;
      expect(typedKey).toBe(validKey);
    });
  });

  describe("CacheKey type", () => {
    test("should work with type-safe functions", () => {
      // Helper function that only accepts CacheKey
      const acceptsCacheKey = (key: CacheKey): string => key;

      const validKey = ZCacheKey.parse("fb:env:test:state");
      expect(acceptsCacheKey(validKey)).toBe("fb:env:test:state");
    });

    test("should maintain string behavior", () => {
      const key = ZCacheKey.parse("fb:test:123");

      // Should work with string methods
      expect(key.length).toBe(11);
      expect(key.startsWith("fb:")).toBe(true);
      expect(key.split(":")).toEqual(["fb", "test", "123"]);
      expect(key.includes("test")).toBe(true);
    });

    test("should be serializable", () => {
      const key = ZCacheKey.parse("fb:serialization:test");

      // Should serialize as regular string
      expect(JSON.stringify({ cacheKey: key })).toBe('{"cacheKey":"fb:serialization:test"}');

      // Should parse back correctly
      const parsed = JSON.parse('{"cacheKey":"fb:serialization:test"}') as { cacheKey: string };
      expect(parsed.cacheKey).toBe("fb:serialization:test");
    });
  });

  describe("CustomCacheNamespace type", () => {
    test("should include expected namespaces", () => {
      // Type test - this will fail at compile time if types don't match
      const analyticsNamespace: CustomCacheNamespace = "analytics";
      expect(analyticsNamespace).toBe("analytics");
    });

    test("should be usable in cache key construction", () => {
      const namespace: CustomCacheNamespace = "analytics";
      const cacheKey = ZCacheKey.parse(`${namespace}:user:123`);
      expect(cacheKey).toBe("analytics:user:123");
    });
  });
});
