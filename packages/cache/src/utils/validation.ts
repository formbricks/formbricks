import type { z } from "zod";
import { logger } from "@formbricks/logger";
import type { CacheError, Result } from "@/types/error";
import { ErrorCode, err, ok } from "@/types/error";

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
      logger.error(
        {
          error: result.error.issues[0]?.message || "Unknown validation error",
          validationErrors: result.error.issues,
        },
        "Cache validation failed"
      );
      return err({
        code: ErrorCode.CacheValidationError,
      });
    }
    results.push(result.data);
  }

  return ok(results as { [K in keyof T]: T[K] extends readonly [unknown, z.ZodType<infer U>] ? U : never });
}
