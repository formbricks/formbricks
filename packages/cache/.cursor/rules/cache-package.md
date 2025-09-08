# @formbricks/cache Package Rules

## Core Principles

### Redis-Only Architecture
- **Mandatory Redis**: All deployments MUST use Redis via `REDIS_URL` environment variable
- **Singleton Client**: Use `getCacheService()` - returns singleton instance per process
- **Result Types**: Core operations return `Result<T, CacheError>` for explicit error handling
- **Never-Failing Wrappers**: `withCache()` always returns function result, handling cache errors internally

### Type Safety & Validation
- **Branded Cache Keys**: Use `CacheKey` type to prevent raw string usage
- **Runtime Validation**: Use `validateInputs()` function with Zod schemas
- **Error Codes**: Use `ErrorCode` enum for consistent error categorization

## File Organization

```text
src/
├── index.ts          # Main exports (getCacheService, createCacheKey, types)
├── client.ts         # Singleton cache service client with Redis connection
├── service.ts        # Core CacheService class with Result types + withCache helpers
├── cache-keys.ts     # Cache key generators with branded types
├── utils/
│   ├── validation.ts # Zod validation utilities
│   └── key.ts        # makeCacheKey utility (not exported)
└── *.test.ts         # Unit tests
types/
├── keys.ts           # Branded CacheKey type & CustomCacheNamespace
├── client.ts         # RedisClient type definition
├── service.ts        # Zod schemas and validateInputs function
├── error.ts          # Result type system and error definitions
└── *.test.ts         # Type tests
```

## Required Patterns

### Singleton Client Pattern
```typescript
// ✅ GOOD - Use singleton client
import { getCacheService } from "@formbricks/cache";
const result = await getCacheService();
if (!result.ok) {
  // Handle initialization error
  throw new Error(`Cache failed: ${result.error.code}`);
}
const cacheService = result.data;

// ❌ BAD - CacheService class not exported for direct instantiation
import { CacheService } from "@formbricks/cache"; // Won't work!
```

### Result Type Error Handling
```typescript
// ✅ GOOD - Core operations return Result<T, CacheError>
const result = await cacheService.get<UserData>(key);
if (!result.ok) {
  switch (result.error.code) {
    case ErrorCode.CacheValidationError:
    case ErrorCode.RedisOperationError:
    case ErrorCode.CacheCorruptionError:
      // Handle based on error code
  }
  return;
}
const data = result.data; // Type-safe access

// ✅ GOOD - withCache never fails, always returns function result
const environmentData = await cacheService.withCache(
  () => fetchEnvironmentFromDB(environmentId),
  createCacheKey.environment.state(environmentId),
  60000
); // Returns T directly, handles cache errors internally
```

### Core Validation & Error Types
```typescript
// Unified error interface
interface CacheError { code: ErrorCode; }

enum ErrorCode {
  Unknown = "unknown",
  CacheValidationError = "cache_validation_error", 
  RedisConnectionError = "redis_connection_error",
  RedisOperationError = "redis_operation_error",
  CacheCorruptionError = "cache_corruption_error",
}

// Key validation: min 1 char, non-whitespace
export const ZCacheKey = z.string().min(1).refine(k => k.trim().length > 0);
// TTL validation: min 1000ms for Redis seconds conversion  
export const ZTtlMs = z.number().int().min(1000).finite();

// Generic validation function
export function validateInputs(...pairs: [unknown, ZodType][]): Result<unknown[], CacheError>;
```

## Cache Key Generation

### Key Generators (cache-keys.ts)
```typescript
export const createCacheKey = {
  environment: {
    state: (environmentId: string): CacheKey,
    config: (environmentId: string): CacheKey,
    segments: (environmentId: string): CacheKey,
  },
  organization: {
    billing: (organizationId: string): CacheKey,
  },
  license: {
    status: (organizationId: string): CacheKey,
    previous_result: (organizationId: string): CacheKey,
  },
  rateLimit: {
    core: (namespace: string, identifier: string, windowStart: number): CacheKey,
  },
  custom: (namespace: CustomCacheNamespace, identifier: string, subResource?: string): CacheKey,
};
```

### Internal Key Utility (utils/key.ts)
- **Not exported** from package - internal only
- **Validates** `fb:resource:identifier[:subresource]*` pattern
- **Prevents empty parts** and malformed keys
- **Runtime validation** with regex patterns

## Service API Methods

```typescript
// Core operations return Result<T, CacheError>
await cacheService.get<T>(key): Promise<Result<T | null, CacheError>>
await cacheService.set(key, value, ttlMs): Promise<Result<void, CacheError>>
await cacheService.del(keys: CacheKey[]): Promise<Result<void, CacheError>>
await cacheService.exists(key): Promise<Result<boolean, CacheError>>

// withCache never fails - returns T directly, handles cache errors internally
await cacheService.withCache<T>(fn, key, ttlMs): Promise<T>

// Direct Redis access for advanced operations (rate limiting, etc.)
cacheService.getRedisClient(): RedisClient | null
```

### Service Implementation - Cognitive Complexity Reduction
The `withCache` method is split into helper methods to reduce cognitive complexity:

```typescript
// Main method (simplified)
async withCache<T>(fn: () => Promise<T>, key: CacheKey, ttlMs: number): Promise<T> {
  // Early returns for Redis availability and validation
  const cachedValue = await this.tryGetCachedValue<T>(key, ttlMs);
  if (cachedValue !== undefined) return cachedValue;
  
  const fresh = await fn();
  await this.trySetCache(key, fresh, ttlMs);
  return fresh;
}

// Helper methods extract complex logic
private async tryGetCachedValue<T>(key, ttlMs): Promise<T | undefined>
private async trySetCache(key, value, ttlMs): Promise<void>
```

## Null vs Undefined Handling

### Caching Behavior
- **`null` values**: Cached normally (represents intentional absence)
- **`undefined` values**: NOT cached (preserves JavaScript semantics)
- **Cache miss**: Returns `null` (Redis returns null for missing keys)

```typescript
// ✅ GOOD - Null values are cached
const nullResult = await cacheService.withCache(
  () => Promise.resolve(null), // Intentional null
  key,
  ttl
); // Returns null, value is cached

// ✅ GOOD - Undefined values are NOT cached  
const undefinedResult = await cacheService.withCache(
  () => Promise.resolve(undefined), // Undefined result
  key,
  ttl
); // Returns undefined, value is NOT cached

// ✅ GOOD - Cache miss detection
const result = await cacheService.get<string>(key);
if (result.ok && result.data === null) {
  const exists = await cacheService.exists(key);
  if (exists.ok && exists.data) {
    // Key exists with null value (cached null)
  } else {
    // True cache miss
  }
}
```

## Logging Standards

### Error Logging Strategy
- **Detailed logging at source** - Log full context where errors occur
- **Clean Result objects** - Only error codes in Result, not messages
- **Level strategy**:
  - `debug`: Cache GET failures in withCache (expected fallback)
  - `debug`: Cache SET failures in withCache (logged but not critical)
  - `warn`: Cache unavailable in withCache (fallback to direct execution)
  - `warn`: Data corruption (concerning but recoverable)
  - `error`: Direct operation failures

```typescript
// ✅ GOOD - Rich logging, clean Result
logger.error("Cache validation failed", { 
  value, 
  error: "TTL must be at least 1000ms",
  validationErrors: [...] 
});
return err({ code: ErrorCode.CacheValidationError });

// ✅ GOOD - withCache handles errors gracefully
logger.warn({ error }, "Cache unavailable; executing function directly");
return await fn(); // Always return function result
```

## Testing Patterns

### Key Test Areas  
- **Result error cases**: Validation, Redis, corruption errors
- **Null vs undefined**: Caching behavior differences
- **withCache fallbacks**: Cache failures gracefully handled  
- **Edge cases**: Empty arrays, invalid TTLs, malformed keys
- **Mock dependencies**: Redis client, logger with all levels

## Web App Integration Pattern

### Cache Facade (apps/web/lib/cache/index.ts)
The web app uses a simplified Proxy-based facade that calls `getCacheService()` directly:

```typescript
// ✅ GOOD - Use cache facade in web app
import { cache } from "@/lib/cache";

// Direct cache operations
const result = await cache.get<UserData>(key);
const success = await cache.set(key, data, ttl);

// Never-failing withCache
const environmentData = await cache.withCache(
  () => fetchEnvironmentFromDB(environmentId),
  createCacheKey.environment.state(environmentId),
  60000
);

// Advanced Redis access for rate limiting
const redis = await cache.getRedisClient();
```

### Proxy Implementation
- **No Singleton Management**: Calls `getCacheService()` for each operation
- **Proxy Pattern**: Transparent method forwarding to underlying cache service  
- **Graceful Degradation**: withCache falls back to direct execution on cache failure
- **Server-Only**: Uses "server-only" import to prevent client-side usage

## Import/Export Standards

```typescript
// ✅ GOOD - Package root exports (index.ts)
export { getCacheService } from "./client";
export type { CacheService } from "./service";
export { createCacheKey } from "./cache-keys";
export type { CacheKey } from "../types/keys";
export type { Result, CacheError } from "../types/error";
export { CacheErrorClass, ErrorCode } from "../types/error";

// ❌ BAD - Don't export these (encapsulation)
// export { createRedisClientFromEnv } from "./client"; // Internal only
// export type { RedisClient } from "../types/client"; // Internal only
// export { CacheService } from "./service"; // Only type exported
```

## Key Rules Summary

1. **Singleton Client**: Use `getCacheService()` - returns singleton per process  
2. **Result Types**: Core ops return `Result<T, CacheError>` - no throwing
3. **Never-Failing withCache**: Returns `T` directly, handles cache errors internally
4. **Validation**: Use `validateInputs()` function for all input validation
5. **Error Interface**: Single `CacheError` interface with just `code` field
6. **Logging**: Rich logging at source, clean Results for consumers
7. **TTL Minimum**: 1000ms minimum for Redis conversion (ms → seconds)
8. **Type Safety**: Branded `CacheKey` type prevents raw string usage
9. **Encapsulation**: RedisClient and createRedisClientFromEnv are internal only
10. **Cognitive Complexity**: Split complex methods into focused helper methods