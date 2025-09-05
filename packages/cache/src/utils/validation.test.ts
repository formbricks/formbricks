import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { ErrorCode } from "@/types/error";
import { validateInputs } from "./validation";

// Mock logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("@formbricks/cache validation utils", () => {
  describe("validateInputs", () => {
    const stringSchema = z.string().min(1);
    const numberSchema = z.number().positive();

    test("should return success for valid inputs", () => {
      const result = validateInputs(["test", stringSchema], [42, numberSchema]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(["test", 42]);
      }
    });

    test("should return error for invalid first input", () => {
      const result = validateInputs(["", stringSchema]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.CacheValidationError);
      }
    });

    test("should return error for invalid second input", () => {
      const result = validateInputs(["valid", stringSchema], [-1, numberSchema]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.CacheValidationError);
      }
    });

    test("should work with single input", () => {
      const result = validateInputs(["test", stringSchema]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(["test"]);
      }
    });

    test("should work with no inputs", () => {
      const result = validateInputs();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual([]);
      }
    });

    test("should return error on first failure in multiple inputs", () => {
      const result = validateInputs(
        ["", stringSchema], // This will fail
        [42, numberSchema] // This would pass but shouldn't be reached
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.CacheValidationError);
      }
    });
  });
});
