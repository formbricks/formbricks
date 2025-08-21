import { z } from "zod";
import { logger } from "@formbricks/logger";
import type { CacheError, Result } from "./error";
import { ErrorCode, err, ok } from "./error";

// Validation schemas for cache service
export const ZCacheKey = z
  .string()
  .min(1, "Cache key cannot be empty")
  .refine((key) => key.trim().length > 0, "Cache key cannot be empty or whitespace only");

export const ZTtlMs = z
  .number()
  .int()
  .min(1000, "TTL must be at least 1000ms (1 second)")
  .finite("TTL must be finite");

/**
 * Generic validation function using Zod schemas with Result types
 * @param pairs - Array of [value, schema] tuples to validate
 * @returns Result with validated data or CacheValidationError
 */
export function validateInputs<T extends readonly [unknown, z.ZodType<unknown>][]>(
  ...pairs: T
): Result<{ [K in keyof T]: T[K] extends readonly [unknown, z.ZodType<infer U>] ? U : never }, CacheError> {
  const results: unknown[] = [];

  for (const [value, schema] of pairs) {
    const result = schema.safeParse(value);
    if (!result.success) {
      logger.error("Cache validation failed", {
        value,
        error: result.error.issues[0]?.message || "Unknown validation error",
        validationErrors: result.error.issues,
      });
      return err({
        code: ErrorCode.CacheValidationError,
      });
    }
    results.push(result.data);
  }

  return ok(results as { [K in keyof T]: T[K] extends readonly [unknown, z.ZodType<infer U>] ? U : never });
}
