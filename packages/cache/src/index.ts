// Service creation - each package handles its own connection
export { createCacheService } from "./factory";

// Service type
export type { CacheService } from "./service";

// Cache key utilities and type-safe key generation
export { createCacheKey } from "./cache-keys";
export type { CacheKey } from "../types/keys";

// Result types and error handling
export type { Result, CacheError } from "../types/error";
export { CacheErrorClass, ErrorCode } from "../types/error";
