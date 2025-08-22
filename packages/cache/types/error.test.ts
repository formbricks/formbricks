import { describe, expect, test } from "vitest";
import { type CacheError, ErrorCode, type Result, err, ok } from "./error";

describe("Error types and utilities", () => {
  describe("ok utility function", () => {
    test("should create success Result with data", () => {
      const data = { test: "value" };
      const result = ok(data);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(data);
      }
    });

    test("should work with different data types", () => {
      const stringResult = ok("test string");
      const numberResult = ok(42);
      const arrayResult = ok([1, 2, 3]);
      const nullResult = ok(null);

      expect(stringResult.ok).toBe(true);
      expect(numberResult.ok).toBe(true);
      expect(arrayResult.ok).toBe(true);
      expect(nullResult.ok).toBe(true);

      if (stringResult.ok) expect(stringResult.data).toBe("test string");
      if (numberResult.ok) expect(numberResult.data).toBe(42);
      if (arrayResult.ok) expect(arrayResult.data).toEqual([1, 2, 3]);
      if (nullResult.ok) expect(nullResult.data).toBe(null);
    });
  });

  describe("err utility function", () => {
    test("should create error Result with error", () => {
      const error: CacheError = { code: ErrorCode.Unknown };
      const result = err(error);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual(error);
      }
    });

    test("should work with different error types", () => {
      const cacheError: CacheError = { code: ErrorCode.CacheValidationError };
      const redisError: CacheError = { code: ErrorCode.RedisOperationError };

      const cacheResult = err(cacheError);
      const redisResult = err(redisError);

      expect(cacheResult.ok).toBe(false);
      expect(redisResult.ok).toBe(false);

      if (!cacheResult.ok) expect(cacheResult.error.code).toBe(ErrorCode.CacheValidationError);
      if (!redisResult.ok) expect(redisResult.error.code).toBe(ErrorCode.RedisOperationError);
    });
  });

  describe("ErrorCode enum", () => {
    test("should have all expected error codes", () => {
      expect(ErrorCode.Unknown).toBe("unknown");
      expect(ErrorCode.CacheValidationError).toBe("cache_validation_error");
      expect(ErrorCode.RedisConnectionError).toBe("redis_connection_error");
      expect(ErrorCode.RedisOperationError).toBe("redis_operation_error");
      expect(ErrorCode.CacheCorruptionError).toBe("cache_corruption_error");
    });

    test("should be usable as object keys", () => {
      const errorMap = {
        [ErrorCode.Unknown]: "Unknown error occurred",
        [ErrorCode.CacheValidationError]: "Validation failed",
        [ErrorCode.RedisConnectionError]: "Connection failed",
        [ErrorCode.RedisOperationError]: "Operation failed",
        [ErrorCode.CacheCorruptionError]: "Data corrupted",
      };

      expect(errorMap[ErrorCode.Unknown]).toBe("Unknown error occurred");
      expect(errorMap[ErrorCode.CacheValidationError]).toBe("Validation failed");
    });
  });

  describe("CacheError interface", () => {
    test("should work with all error codes", () => {
      const errors: CacheError[] = [
        { code: ErrorCode.Unknown },
        { code: ErrorCode.CacheValidationError },
        { code: ErrorCode.RedisConnectionError },
        { code: ErrorCode.RedisOperationError },
        { code: ErrorCode.CacheCorruptionError },
      ];

      errors.forEach((error) => {
        expect(typeof error.code).toBe("string");
        expect(Object.values(ErrorCode)).toContain(error.code);
      });
    });
  });

  describe("Result type", () => {
    test("should discriminate between success and error states", () => {
      const successResult: Result<string, CacheError> = ok("success");
      const errorResult: Result<string, CacheError> = err({ code: ErrorCode.Unknown });

      // TypeScript should narrow types correctly
      if (successResult.ok) {
        expect(typeof successResult.data).toBe("string");
        expect(successResult.data).toBe("success");
      }

      if (!errorResult.ok) {
        expect(typeof errorResult.error.code).toBe("string");
        expect(errorResult.error.code).toBe(ErrorCode.Unknown);
      }
    });

    test("should support type safety with different data types", () => {
      // This test verifies type compatibility at compile time
      const stringResult: Result<string, CacheError> = ok("test");
      const numberResult: Result<number, CacheError> = ok(42);
      const objectResult: Result<{ id: string }, CacheError> = ok({ id: "123" });

      expect(stringResult.ok).toBe(true);
      expect(numberResult.ok).toBe(true);
      expect(objectResult.ok).toBe(true);
    });
  });

  describe("Module exports", () => {
    test("should export all required types and utilities", () => {
      // Verify functions are exported
      expect(typeof ok).toBe("function");
      expect(typeof err).toBe("function");

      // Verify enum is exported
      expect(typeof ErrorCode).toBe("object");
      expect(ErrorCode).toBeDefined();

      // Type exports verification (compile-time check)
      const typeTest = {
        Result: "Result" as keyof { Result: Result<unknown, unknown> },
        CacheError: "CacheError" as keyof { CacheError: CacheError },
      };

      expect(typeTest.Result).toBe("Result");
      expect(typeTest.CacheError).toBe("CacheError");
    });
  });
});
