import { z } from "zod";

/**
 * Branded type for cache keys to prevent raw string usage
 * This ensures only properly generated cache keys can be used in cache operations
 */
export const ZCacheKey = z
  .string()
  .min(1, "Cache key cannot be empty")
  .refine((key) => key.trim().length > 0, "Cache key cannot be empty or whitespace only")
  .brand("CacheKey");

export type CacheKey = z.infer<typeof ZCacheKey>;

/**
 * Possible namespaces for custom cache keys
 * Add new namespaces here as they are introduced
 */
export type CustomCacheNamespace = "analytics";
