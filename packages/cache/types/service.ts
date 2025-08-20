import { z } from "zod";
import { logger } from "@formbricks/logger";

// Validation schemas for cache service
export const ZCacheKey = z
  .string()
  .min(1, "Cache key cannot be empty")
  .refine((key) => key.trim().length > 0, "Cache key cannot be empty or whitespace only");

export const ZTtlMs = z.number().positive("TTL must be greater than 0");

// Default error class for cache validation
export class CacheValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CacheValidationError";
  }
}

/**
 * Validate inputs using Zod schemas following project standards
 */
export function validateInputs<T extends readonly [unknown, z.ZodType<unknown>][]>(
  ...pairs: T
): { [K in keyof T]: T[K] extends readonly [unknown, z.ZodType<infer U>] ? U : never } {
  const results: unknown[] = [];

  for (const [value, schema] of pairs) {
    const result = schema.safeParse(value);
    if (!result.success) {
      logger.error(result.error, "Cache validation failed");
      throw new CacheValidationError("Cache validation failed");
    }
    results.push(result.data);
  }

  return results as { [K in keyof T]: T[K] extends readonly [unknown, z.ZodType<infer U>] ? U : never };
}
