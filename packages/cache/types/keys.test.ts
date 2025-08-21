import { describe, expect, test } from "vitest";
import { type CacheKey, asCacheKey } from "./keys";

describe("@formbricks/cache types/keys", () => {
  describe("CacheKey branded type", () => {
    test("should create branded CacheKey from string", () => {
      const key = asCacheKey("fb:test:123:data");
      expect(typeof key).toBe("string");
      expect(key).toBe("fb:test:123:data");
    });

    test("should work with type-safe functions", () => {
      // Helper function that only accepts CacheKey
      const acceptsCacheKey = (key: CacheKey): string => key;

      const brandedKey = asCacheKey("fb:env:test:state");
      expect(acceptsCacheKey(brandedKey)).toBe("fb:env:test:state");
    });

    test("should maintain string behavior", () => {
      const key = asCacheKey("fb:test:123");

      // Should work with string methods
      expect(key.length).toBe(11);
      expect(key.startsWith("fb:")).toBe(true);
      expect(key.split(":")).toEqual(["fb", "test", "123"]);
      expect(key.includes("test")).toBe(true);
    });

    test("should be serializable", () => {
      const key = asCacheKey("fb:serialization:test");

      // Should serialize as regular string
      expect(JSON.stringify({ cacheKey: key })).toBe('{"cacheKey":"fb:serialization:test"}');

      // Should parse back correctly
      const parsed = JSON.parse('{"cacheKey":"fb:serialization:test"}') as { cacheKey: string };
      expect(parsed.cacheKey).toBe("fb:serialization:test");
    });
  });

  describe("asCacheKey helper", () => {
    test("should cast string to CacheKey", () => {
      const rawString = "fb:helper:test:key";
      const cacheKey = asCacheKey(rawString);

      expect(cacheKey).toBe(rawString);
      expect(typeof cacheKey).toBe("string");
    });

    test("should preserve original string content", () => {
      const original = "fb:preserve:content:123:with:many:parts";
      const branded = asCacheKey(original);

      expect(branded).toBe(original);
      expect(branded.toString()).toBe(original);
    });
  });
});
