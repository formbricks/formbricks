/**
 * Branded type for cache keys to prevent raw string usage
 * This ensures only properly generated cache keys can be used in cache operations
 */
export type CacheKey = string & { readonly __brand: "CacheKey" };

/**
 * Internal helper to cast a string to CacheKey type
 * This should only be used within cache key generators
 * @internal
 */
export const asCacheKey = (key: string): CacheKey => key as CacheKey;
