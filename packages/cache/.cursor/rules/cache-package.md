# @formbricks/cache Package Rules

## Core Principles

### Redis-Only Architecture
- **Mandatory Redis**: All deployments MUST use Redis via `REDIS_URL` environment variable
- **Factory Pattern**: Use `createCacheService()` - never export `CacheService` class directly
- **Result Types**: All operations return `Result<T, CacheError>` instead of throwing exceptions

### Type Safety & Validation
- **Branded Cache Keys**: Use `CacheKey` type to prevent raw string usage
- **Runtime Validation**: Use `validateInputs()` function with Zod schemas
- **Error Codes**: Use `ErrorCode` enum for consistent error categorization

## File Organization

```text
src/
├── index.ts          # Main exports (factory only, no CacheService class)
├── factory.ts        # Redis client factory and CacheService factory
├── service.ts        # Core CacheService class with Result types
├── cache-keys.ts     # Cache key generators with branded types
├── utils/key.ts      # makeCacheKey utility (not exported)
└── *.test.ts         # Unit tests
types/
├── keys.ts           # Branded CacheKey type & CustomCacheNamespace
├── client.ts         # RedisClient type definition
├── service.ts        # Zod schemas and validateInputs function
├── error.ts          # Result type system and error definitions
└── *.test.ts         # Type tests
```

## Required Patterns

### Factory Pattern Usage
```typescript
// ✅ GOOD - Use factory
import { createCacheService } from "@formbricks/cache";
const cacheService = createCacheService();

// ❌ BAD - CacheService not exported
import { CacheService } from "@formbricks/cache"; // Won't work!
```

### Result Type Error Handling
```typescript
// ✅ GOOD - All operations return Result<T, CacheError>
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
```

### Validation Pattern
```typescript
// ✅ GOOD - Use validateInputs for all validation
const validation = validateInputs([key, ZCacheKey], [ttlMs, ZTtlMs]);
if (!validation.ok) {
  return validation; // Propagate error
}
const [validatedKey, validatedTtl] = validation.data;

// ❌ BAD - Don't use separate validation calls
```

### Error Interface
```typescript
// Unified error interface - just error code
export interface CacheError {
  code: ErrorCode;
}

// Error codes enum
export enum ErrorCode {
  Unknown = "unknown",
  CacheValidationError = "cache_validation_error",
  RedisConnectionError = "redis_connection_error",
  RedisOperationError = "redis_operation_error", 
  CacheCorruptionError = "cache_corruption_error",
}
```

## Validation Standards

### Zod Schemas (types/service.ts)
```typescript
// Cache key validation
export const ZCacheKey = z.string().min(1, "Cache key cannot be empty").refine(
  (key) => key.trim().length > 0,
  "Cache key cannot be empty or whitespace only"
);

// TTL validation (minimum 1000ms for Redis conversion)
export const ZTtlMs = z
  .number()
  .int()
  .min(1000, "TTL must be at least 1000ms (1 second)")
  .finite("TTL must be finite");
```

### Generic Validation Function
```typescript
// Single validation function for all scenarios
export function validateInputs<T extends readonly [unknown, z.ZodType<unknown>][]>(
  ...pairs: T
): Result<
  { [K in keyof T]: T[K] extends readonly [unknown, z.ZodType<infer U>] ? U : never },
  CacheError
>;
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
// All methods return Result<T, CacheError>
await cacheService.get<T>(key): Promise<Result<T | null, CacheError>>
await cacheService.set(key, value, ttlMs): Promise<Result<void, CacheError>>
await cacheService.del(keys: CacheKey[]): Promise<Result<void, CacheError>>
await cacheService.withCache<T>(fn, key, ttlMs): Promise<Result<T, CacheError>>
```

## Logging Standards

### Error Logging Strategy
- **Detailed logging at source** - Log full context where errors occur
- **Clean Result objects** - Only error codes in Result, not messages
- **Level strategy**:
  - `debug`: Cache GET failures in withCache (expected fallback)
  - `error`: Cache SET failures in withCache (unexpected when fresh data available)
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
```

## Testing Requirements

### Mock Patterns
```typescript
// Mock logger with all levels
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Redis client
interface MockRedisClient {
  get: ReturnType<typeof vi.fn>;
  setEx: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
}
```

### Test Structure
- **Test all Result error cases** - Validation, Redis, corruption errors
- **Test edge cases** - Empty arrays, invalid TTLs, malformed keys
- **Mock external dependencies** - Redis client, logger
- **Array-based deletion** - Test `del([key1, key2])` pattern

## Import/Export Standards

```typescript
// ✅ GOOD - Package root exports
export { createCacheService, createRedisClientFromEnv } from "./factory";
export { createCacheKey } from "./cache-keys";
export type { CacheKey } from "../types/keys";
export type { RedisClient } from "../types/client";
export type { Result, CacheError, ErrorCode } from "../types/error";

// ❌ BAD - Don't export CacheService class
// export { CacheService } from "./service"; // Never do this!
```

## Key Rules Summary

1. **Factory Pattern**: Always use `createCacheService()`, never export `CacheService` class
2. **Result Types**: All operations return `Result<T, CacheError>` - no throwing exceptions
3. **Validation**: Use `validateInputs()` function for all input validation
4. **Error Interface**: Single `CacheError` interface with just `code` field
5. **Logging**: Rich logging at source, clean Results for consumers
6. **TTL Minimum**: 1000ms minimum for Redis conversion (ms → seconds)
7. **Array Deletion**: `del()` method always accepts arrays
8. **Type Safety**: Branded `CacheKey` type prevents raw string usage
