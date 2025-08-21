import { describe, expect, test, vi } from "vitest";
import { ZCacheKey, ZTtlMs, validateInputs } from "./service";

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
    test("should validate valid TTL values", () => {
      expect(ZTtlMs.parse(1000)).toBe(1000);
      expect(ZTtlMs.parse(5000)).toBe(5000);
      expect(ZTtlMs.parse(7200000)).toBe(7200000); // 2 hours
    });

    test("should reject values below 1000ms", () => {
      expect(() => ZTtlMs.parse(0)).toThrow("TTL must be at least 1000ms (1 second)");
      expect(() => ZTtlMs.parse(500)).toThrow("TTL must be at least 1000ms (1 second)");
      expect(() => ZTtlMs.parse(999)).toThrow("TTL must be at least 1000ms (1 second)");
    });

    test("should reject negative numbers", () => {
      expect(() => ZTtlMs.parse(-1)).toThrow("TTL must be at least 1000ms (1 second)");
      expect(() => ZTtlMs.parse(-1000)).toThrow("TTL must be at least 1000ms (1 second)");
    });

    test("should reject non-integer values", () => {
      expect(() => ZTtlMs.parse(1000.5)).toThrow("Expected integer, received float");
      expect(() => ZTtlMs.parse(1500.25)).toThrow("Expected integer, received float");
    });

    test("should reject non-finite values", () => {
      expect(() => ZTtlMs.parse(NaN)).toThrow("Expected number, received nan");
      expect(() => ZTtlMs.parse(Infinity)).toThrow("TTL must be finite");
      expect(() => ZTtlMs.parse(-Infinity)).toThrow("TTL must be finite");
    });

    test("should reject non-numeric values", () => {
      expect(() => ZTtlMs.parse("1000")).toThrow("Expected number, received string");
      expect(() => ZTtlMs.parse(null)).toThrow("Expected number, received null");
      expect(() => ZTtlMs.parse(undefined)).toThrow("Required");
    });
  });

  describe("validateInputs", () => {
    test("should validate valid inputs and return Result with data", () => {
      const result = validateInputs(["test-key", ZCacheKey], [5000, ZTtlMs]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(["test-key", 5000]);
      }
    });

    test("should return error for invalid cache key", () => {
      const result = validateInputs(["", ZCacheKey]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("cache_validation_error");
      }
    });

    test("should return error for invalid TTL", () => {
      const result = validateInputs(["valid-key", ZCacheKey], [500, ZTtlMs]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("cache_validation_error");
      }
    });

    test("should validate single input", () => {
      const result = validateInputs(["valid-key", ZCacheKey]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(["valid-key"]);
      }
    });
  });
});
