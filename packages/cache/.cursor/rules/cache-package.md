# @formbricks/cache Package Rules

## Core Principles

### Redis-Only Architecture

- **Mandatory Redis**: All deployments MUST use Redis via `REDIS_URL` environment variable
- **Singleton Client**: Use `getCacheService()` - returns singleton instance per process using `globalThis`
- **Result Types**: Core operations return `Result<T, CacheError>` for explicit error handling
- **Never-Failing Wrappers**: `withCache()` always returns function result, handling cache errors internally
- **Cross-Platform**: Uses `globalThis` for Edge Runtime, Lambda, and HMR compatibility

### Type Safety & Validation

- **Branded Cache Keys**: Use `CacheKey` type to prevent raw string usage
- **Runtime Validation**: Use `validateInputs()` function with Zod schemas
- **Error Codes**: Use `ErrorCode` enum for consistent error categorization

## File Organization

```text
src/
├── index.ts                    # Main exports
├── client.ts                   # globalThis singleton with getCacheService()
├── service.ts                  # CacheService class with Result types + withCache
├── cache-keys.ts               # Cache key generators with branded types
├── cache-integration.test.ts   # E2E tests exercising Redis operations
├── utils/
│   ├── validation.ts           # Zod validation utilities
│   └── key.ts                  # makeCacheKey utility (not exported)
└── *.test.ts                   # Unit tests
types/
├── keys.ts                     # Branded CacheKey type & CustomCacheNamespace
├── client.ts                   # RedisClient type definition
├── service.ts                  # Zod schemas and validateInputs function
├── error.ts                    # Result type system and error definitions
└── *.test.ts                   # Type tests
```

## Required Patterns

### globalThis Singleton Pattern

```typescript
// ✅ GOOD - Use globalThis singleton client
import { getCacheService } from "@formbricks/cache";
// ✅ GOOD - Production validation (index.ts)
import { validateRedisConfig } from "@formbricks/cache";
// Throws if REDIS_URL missing in production

// ❌ BAD - CacheService class not exported for direct instantiation
import { CacheService } from "@formbricks/cache";

const result = await getCacheService();
if (!result.ok) {
  // Handle initialization error - Redis connection failed
  logger.error({ error: result.error }, "Cache service unavailable");
  throw new Error(`Cache failed: ${result.error.code}`);
}
const cacheService = result.data;

validateRedisConfig(); // Throws if REDIS_URL missing in production

// Won't work!
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

// ✅ GOOD - Structured logging with context first
logger.error({ error, key, operation: "cache_get" }, "Cache operation failed");
logger.warn({ error }, "Cache unavailable; executing function directly");
```

### Core Validation & Error Types

```typescript
// Unified error interface
interface CacheError {
  code: ErrorCode;
}

enum ErrorCode {
  Unknown = "unknown",
  CacheValidationError = "cache_validation_error",
  RedisConnectionError = "redis_connection_error",
  RedisOperationError = "redis_operation_error",
  CacheCorruptionError = "cache_corruption_error",
}

// Key validation: min 1 char, non-whitespace
export const ZCacheKey = z
  .string()
  .min(1)
  .refine((k) => k.trim().length > 0);
// TTL validation: min 1000ms for Redis seconds conversion
export const ZTtlMs = z.number().int().min(1000).finite();

// Generic validation function (returns array of validated values)
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

// Redis availability check with ping test (standardized across codebase)
await cacheService.isRedisAvailable(): Promise<boolean>

// Direct Redis access for advanced operations (rate limiting, etc.)
cacheService.getRedisClient(): RedisClient | null
```

### Redis Availability Method

Standardized Redis connectivity check across the codebase.

**Method Implementation:**

- `isRedisAvailable()`: Checks client state (`isReady && isOpen`) + Redis ping test
- Returns `Promise<boolean>` - true if Redis is available and responsive
- Used for health monitoring, status checks, and external validation

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

### Unit Tests (\*.test.ts)

- **Result error cases**: Validation, Redis, corruption errors
- **Null vs undefined**: Caching behavior differences
- **withCache fallbacks**: Cache failures gracefully handled
- **Edge cases**: Empty arrays, invalid TTLs, malformed keys
- **Mock dependencies**: Redis client, logger with all levels

### Integration Tests (cache-integration.test.ts)

- **End-to-End Redis Operations**: Tests against live Redis instance
- **Auto-Skip Logic**: Automatically skips when Redis unavailable (`REDIS_URL` not set)
- **Comprehensive Coverage**: All cache operations through real code paths
- **CI Integration**: Runs in E2E workflow with Redis/Valkey service
- **Logger Integration**: Uses `@formbricks/logger` with structured logging

```typescript
// ✅ Integration test pattern
describe("Cache Integration Tests", () => {
  beforeAll(async () => {
    isRedisAvailable = await checkRedisAvailability();
    if (!isRedisAvailable) {
      logger.info("🟡 Tests skipped - Redis not available");
      return;
    }
    logger.info("🟢 Tests will run - Redis available");
  });

  test("withCache miss/hit pattern", async () => {
    if (!isRedisAvailable) {
      logger.info("Skipping test: Redis not available");
      return;
    }
    // Test cache miss -> hit behavior with real Redis
  });
});
```

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

- **Lazy Initialization**: Calls `getCacheService()` for each operation via Proxy
- **Graceful Degradation**: `withCache` falls back to direct execution on cache failure
- **Server-Only**: Uses "server-only" import to prevent client-side usage
- **Production Validation**: Validates `REDIS_URL` at module initialization

## Architecture Updates

### globalThis Singleton (client.ts)

```typescript
// Cross-platform singleton using globalThis (not global)
const globalForCache = globalThis as unknown as {
  formbricksCache: CacheService | undefined;
  formbricksCacheInitializing: Promise<Result<CacheService, CacheError>> | undefined;
};

// Prevents multiple Redis connections in HMR/serverless/Edge Runtime
export async function getCacheService(): Promise<Result<CacheService, CacheError>>;
```

### Fast-Fail Connection Strategy

- **No Reconnection in Factory**: Redis client uses fast-fail connection
- **Background Reconnection**: Handled by Redis client's built-in retry logic
- **Early Checks**: `isReady` check at method start to avoid 1-second timeouts
- **Graceful Degradation**: `withCache` executes function when cache unavailable

## Key Rules Summary

1. **globalThis Singleton**: Use `getCacheService()` - cross-platform singleton
2. **Result Types**: Core ops return `Result<T, CacheError>` - no throwing
3. **Never-Failing withCache**: Returns `T` directly, handles cache errors internally
4. **Standardized Redis Check**: Use `isRedisAvailable()` method with ping test
5. **Structured Logging**: Context object first, then message string
6. **Fast-Fail Strategy**: Early Redis availability checks, no blocking timeouts
7. **Integration Testing**: E2E tests with auto-skip logic for development
8. **Production Validation**: Mandatory `REDIS_URL` with startup validation
9. **Cross-Platform**: Uses `globalThis` for Edge Runtime/Lambda compatibility
10. **CI Integration**: Cache tests run in E2E workflow with Redis service
11. **Cognitive Complexity**: Split complex methods into focused helper methods
