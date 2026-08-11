import { describe, expect, test } from "vitest";
import { type CacheError, CacheErrorClass, ErrorCode, type Result, err, ok } from "./error";

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

  describe("CacheErrorClass", () => {
    test("should create proper Error instances with code and message", () => {
      const error = new CacheErrorClass(ErrorCode.RedisConnectionError, "Custom error message");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CacheErrorClass);
      expect(error.name).toBe("CacheError");
      expect(error.message).toBe("Custom error message");
      expect(error.code).toBe(ErrorCode.RedisConnectionError);
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe("string");
    });

    test("should create Error instances with default message", () => {
      const error = new CacheErrorClass(ErrorCode.CacheValidationError);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CacheErrorClass);
      expect(error.name).toBe("CacheError");
      expect(error.message).toBe("Cache error: cache_validation_error");
      expect(error.code).toBe(ErrorCode.CacheValidationError);
      expect(error.stack).toBeDefined();
    });

    test("should work with all ErrorCode values", () => {
      // Test a representative sample to avoid deep nesting warnings
      const testCodes = [
        ErrorCode.Unknown,
        ErrorCode.CacheValidationError,
        ErrorCode.RedisConnectionError,
        ErrorCode.RedisOperationError,
        ErrorCode.CacheCorruptionError,
      ];

      testCodes.forEach((code) => {
        const error = new CacheErrorClass(code, `Test error for ${code}`);

        expect(error.code).toBe(code);
        expect(error.message).toBe(`Test error for ${code}`);
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(CacheErrorClass);
      });
    });

    test("should implement CacheError interface", () => {
      const error = new CacheErrorClass(ErrorCode.RedisOperationError, "Test message");

      // Should be assignable to CacheError interface
      const cacheError: CacheError = error;
      expect(cacheError.code).toBe(ErrorCode.RedisOperationError);
    });

    test("should be throwable and catchable", () => {
      expect(() => {
        throw new CacheErrorClass(ErrorCode.CacheCorruptionError, "Data corrupted");
      }).toThrow("Data corrupted");

      try {
        throw new CacheErrorClass(ErrorCode.RedisConnectionError, "Connection failed");
      } catch (error) {
        expect(error).toBeInstanceOf(CacheErrorClass);
        expect(error).toBeInstanceOf(Error);
        if (error instanceof CacheErrorClass) {
          expect(error.code).toBe(ErrorCode.RedisConnectionError);
          expect(error.message).toBe("Connection failed");
        }
      }
    });

    describe("fromCacheError static method", () => {
      test("should convert plain CacheError to CacheErrorClass", () => {
        const plainError: CacheError = { code: ErrorCode.CacheValidationError };
        const errorClass = CacheErrorClass.fromCacheError(plainError);

        expect(errorClass).toBeInstanceOf(Error);
        expect(errorClass).toBeInstanceOf(CacheErrorClass);
        expect(errorClass.code).toBe(ErrorCode.CacheValidationError);
        expect(errorClass.message).toBe("Cache error: cache_validation_error");
        expect(errorClass.name).toBe("CacheError");
      });

      test("should use custom message when provided", () => {
        const plainError: CacheError = { code: ErrorCode.RedisOperationError };
        const errorClass = CacheErrorClass.fromCacheError(plainError, "Custom conversion message");

        expect(errorClass.code).toBe(ErrorCode.RedisOperationError);
        expect(errorClass.message).toBe("Custom conversion message");
        expect(errorClass).toBeInstanceOf(Error);
        expect(errorClass).toBeInstanceOf(CacheErrorClass);
      });

      test("should preserve error code from plain object", () => {
        // Test a few key error codes to avoid deep nesting warning
        const testCodes = [
          ErrorCode.CacheValidationError,
          ErrorCode.RedisConnectionError,
          ErrorCode.RedisOperationError,
        ];

        testCodes.forEach((code) => {
          const plainError: CacheError = { code };
          const errorClass = CacheErrorClass.fromCacheError(plainError, `Converted ${code}`);

          expect(errorClass.code).toBe(code);
          expect(errorClass.message).toBe(`Converted ${code}`);
        });
      });
    });

    test("should maintain proper prototype chain", () => {
      const error = new CacheErrorClass(ErrorCode.Unknown, "Test error");

      // Verify prototype chain
      expect(Object.getPrototypeOf(error)).toBe(CacheErrorClass.prototype);
      expect(Object.getPrototypeOf(CacheErrorClass.prototype)).toBe(Error.prototype);

      // Verify constructor
      expect(error.constructor).toBe(CacheErrorClass);
    });

    test("should have enumerable code property", () => {
      const error = new CacheErrorClass(ErrorCode.RedisConnectionError, "Test");
      const descriptor = Object.getOwnPropertyDescriptor(error, "code");

      expect(descriptor).toBeDefined();
      expect(descriptor?.enumerable).toBe(true);
      expect(descriptor?.value).toBe(ErrorCode.RedisConnectionError);
    });

    test("should work with JSON.stringify", () => {
      const error = new CacheErrorClass(ErrorCode.CacheValidationError, "Validation failed");

      // JSON.stringify should include the code property (public field)
      const json = JSON.stringify(error);
      const parsed = JSON.parse(json) as Record<string, unknown>;

      expect(parsed.code).toBe(ErrorCode.CacheValidationError);
      // Note: Error's message and name are not enumerable by default in JSON.stringify
      // Only the public 'code' property will be serialized
      expect(parsed.code).toBeDefined();
    });
  });

  describe("Module exports", () => {
    test("should export all required types and utilities", () => {
      // Verify functions are exported
      expect(typeof ok).toBe("function");
      expect(typeof err).toBe("function");

      // Verify classes are exported
      expect(typeof CacheErrorClass).toBe("function");
      expect(CacheErrorClass.prototype).toBeInstanceOf(Error);

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
