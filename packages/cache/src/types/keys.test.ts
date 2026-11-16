import { describe, expect, test } from "vitest";
import { type CacheKey, ZCacheKey } from "./keys";

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
});
