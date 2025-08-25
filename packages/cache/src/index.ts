// Factory functions for Redis client and cache service
export { createRedisClientFromEnv, createCacheService } from "./factory";

// Cache key utilities and type-safe key generation
export { createCacheKey } from "./cache-keys";
export type { CacheKey } from "../types/keys";

// Redis client type
export type { RedisClient } from "../types/client";

// Result types and error handling
export type { Result, CacheError, ErrorCode } from "../types/error";
