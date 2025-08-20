import { describe, expect, test, vi } from "vitest";
import { CacheValidationError, ZCacheKey, ZTtlMs, validateInputs } from "./service";

// Mock logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("Cache validation", () => {
  describe("ZCacheKey", () => {
    test("should validate non-empty strings", () => {
      expect(ZCacheKey.parse("valid-key")).toBe("valid-key");
    });

    test("should reject empty strings", () => {
      expect(() => ZCacheKey.parse("")).toThrow();
    });

    test("should reject whitespace-only strings", () => {
      expect(() => ZCacheKey.parse("   ")).toThrow();
    });
  });

  describe("ZTtlMs", () => {
    test("should validate positive numbers", () => {
      expect(ZTtlMs.parse(1000)).toBe(1000);
    });

    test("should reject zero", () => {
      expect(() => ZTtlMs.parse(0)).toThrow();
    });

    test("should reject negative numbers", () => {
      expect(() => ZTtlMs.parse(-1)).toThrow();
    });
  });

  describe("CacheValidationError", () => {
    test("should create error with correct name and message", () => {
      const error = new CacheValidationError("Test error");

      expect(error.name).toBe("CacheValidationError");
      expect(error.message).toBe("Test error");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("validateInputs", () => {
    test("should validate valid inputs", () => {
      const [key, ttl] = validateInputs(["test-key", ZCacheKey], [1000, ZTtlMs]);

      expect(key).toBe("test-key");
      expect(ttl).toBe(1000);
    });

    test("should throw CacheValidationError for invalid inputs", () => {
      expect(() => {
        validateInputs(["", ZCacheKey]);
      }).toThrow(CacheValidationError);
    });

    test("should validate single input", () => {
      const [key] = validateInputs(["valid-key", ZCacheKey]);

      expect(key).toBe("valid-key");
    });
  });
});
