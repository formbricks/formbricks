# @formbricks/cache Package Rules

## Package Overview
Unified Redis cache package for Formbricks. Provides a type-safe, Redis-only caching solution with comprehensive validation and error handling.

## Architecture Principles

### 1. Redis-Only Strategy
- **Mandatory Redis**: All deployments MUST use Redis. No fallback to in-memory caching.
- **Environment-driven**: Redis connection configured via `REDIS_URL` environment variable only.

### 2. Type Safety & Validation
- **Strict TypeScript**: All code must pass strict TypeScript compilation.
- **Branded Cache Keys**: Use `CacheKey` branded type to prevent raw string usage.
- **Zod Validation**: Runtime validation using Zod schemas for cache keys and TTL values.
- **Custom Error Types**: `CacheValidationError` for validation failures.

### 3. Factory Pattern
- **Service Creation**: `createCacheService()` returns ready-to-use `CacheService` instances.
- **Redis Client Injection**: Accept Redis client as parameter for testability.
- **Complete Setup**: Factory handles Redis connection + service instantiation.

## Code Standards

### File Organization
```text
src/
├── index.ts          # Main exports
├── factory.ts        # Redis client and CacheService factory
├── service.ts        # Core CacheService class
├── cache-keys.ts     # Cache key generators with branded types
└── *.test.ts         # Unit tests (collocated with source)
types/
├── keys.ts           # Branded CacheKey type definition
├── service.ts        # Validation schemas and utilities
└── *.test.ts         # Type and validation tests
```

### Naming Conventions
- **Functions**: Use camelCase (e.g., `createCacheService`, `createCacheKey`)
- **Types**: Use PascalCase (e.g., `RedisClient`, `CacheKey`, `CacheService`)
- **Classes**: Use PascalCase (e.g., `CacheService`, `CacheValidationError`)
- **Files**: Use kebab-case for multi-word files (e.g., `cache-keys.ts`)

### Import/Export Patterns
```typescript
// ✅ GOOD - Named exports from index.ts
export { createCacheService, createRedisClientFromEnv, type RedisClient } from "./factory";
export { createCacheKey } from "./cache-keys";
export { CacheService } from "./service";
export type { CacheKey } from "../types/keys";

// ✅ GOOD - Import from package root
import { createCacheService, createCacheKey, CacheService } from "@formbricks/cache";

// ❌ BAD - Deep imports
import { createCacheService } from "@formbricks/cache/dist/factory";
```

## Validation Standards

### Zod Schemas (in `types/service.ts`)
```typescript
// Cache key validation
export const ZCacheKey = z.string().min(1, "Cache key cannot be empty").refine(
  (key) => key.trim().length > 0,
  "Cache key cannot be empty or whitespace only"
);

// TTL validation
export const ZTtlMs = z.number().positive("TTL must be greater than 0");

// Validation helper
export function validateInputs<T extends readonly [unknown, z.ZodType<unknown>][]>(
  ...pairs: T
): ValidatedInputs<T>;
```

### Error Handling
- **Validation Errors**: Use `CacheValidationError` for validation failures.
- **Redis Errors**: Log and re-throw Redis connection/operation errors.
- **Corruption Handling**: Treat JSON parse failures as cache misses, log corruption.
- **No Sensitive Data**: Never log cache values, only keys and error details.

```typescript
// ✅ GOOD - Safe corruption handling
} catch (parseError) {
  logger.warn("Corrupted cache data detected, treating as cache miss", { 
    key, 
    parseError 
  });
  return null; // Cache miss, app will regenerate
}
```

## Core CacheService API

### Service Class
```typescript
export class CacheService {
  constructor(private readonly redis: RedisClient) {}
  
  // Basic operations with validation
  async get<T>(key: CacheKey): Promise<T | null>
  async set(key: CacheKey, value: unknown, ttlMs: number): Promise<void>
  async del(keys: CacheKey | CacheKey[]): Promise<void>
  
  // High-level cache-aside pattern
  async withCache<T>(fn: () => Promise<T>, key: CacheKey, ttlMs: number): Promise<T>
}
```

### Data Handling
- **JSON Serialization**: All values stored as JSON strings in Redis.
- **Type-safe Retrieval**: Generic `get<T>()` for compile-time type safety.
- **Corruption Recovery**: JSON parse failures treated as cache miss + warning.
- **Error Tolerance**: Cache errors don't break application flow.

## Testing Standards

### Unit Test Requirements
- **85% Coverage**: Comprehensive test coverage for all public methods.
- **Collocated Tests**: Place `*.test.ts` files next to source files.
- **Mock Dependencies**: Mock Redis client and logger in tests.
- **Validation Testing**: Test all Zod validation schemas and error conditions.

### Test Structure
```typescript
// ✅ GOOD - Comprehensive test coverage
describe("CacheService", () => {
  describe("get", () => {
    test("should return parsed JSON value when found");
    test("should return null when key not found");
    test("should return null when JSON parse fails (corrupted data)");
    test("should throw CacheValidationError for empty key");
  });
  
  describe("withCache", () => {
    test("should return cached value when available");
    test("should compute and cache value when cache miss");
    test("should return fresh value when cache operation fails");
  });
});
```

### Mock Patterns
```typescript
// ✅ GOOD - Type-safe mocking
interface MockRedisClient {
  get: ReturnType<typeof vi.fn>;
  setEx: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
}

const mockRedis: MockRedisClient = {
  get: vi.fn(),
  setEx: vi.fn(),
  del: vi.fn(),
};
const cacheService = new CacheService(mockRedis as unknown as RedisClient);
```

## Performance Guidelines

### Connection Management
- **Reconnection Strategy**: Exponential backoff for first 5 attempts (max 5s), then 30s intervals.
- **Connection Events**: Comprehensive logging for all Redis connection events.
- **Lazy Connection**: Connect only when needed via `createCacheService`.

### Validation Performance
- **Negligible Overhead**: Zod validation is ~0.001ms vs ~1-10ms for Redis I/O.
- **Defensive Design**: Validate inputs at every public method for safety.
- **No Optimization**: Don't optimize away validation - it's not a bottleneck.

## Security Requirements

### Access Control
- **Environment Variables**: Use `REDIS_URL` only for connection configuration.
- **No Hardcoded Credentials**: Never commit credentials to code.
- **Safe Logging**: Never log cache values, only keys and metadata.

### Data Protection
```typescript
// ✅ GOOD - Safe logging
logger.warn("Corrupted cache data detected, treating as cache miss", { 
  key,           // ✅ Safe - usually non-sensitive identifiers
  parseError     // ✅ Safe - just JSON parsing error details
  // ❌ NO value logging - could contain PII/tokens
});
```

## Dependencies

### Production Dependencies
- **`redis@5.8.1`**: Official Redis client 
- **`@formbricks/logger`**: Internal logging package
- **`zod@3.24.4`**: Runtime validation

### Development Dependencies
- **`@formbricks/config-typescript`**: Shared TypeScript config
- **`@formbricks/eslint-config`**: Shared ESLint config
- **`vite`**: Build tool for ES/CJS output
- **`vitest`**: Testing framework
- **`@vitest/coverage-v8`**: Coverage reporting

## API Reference

### Factory Functions
```typescript
// Create Redis client from REDIS_URL environment variable
export function createRedisClientFromEnv(): RedisClient;

// Create connected CacheService instance
export async function createCacheService(redis?: RedisClient): Promise<CacheService>;

// Redis client type
export type RedisClient = RedisClientType;
```

### Cache Key Generation
```typescript
// Branded type for compile-time safety
export type CacheKey = string & { readonly __brand: "CacheKey" };

// Type-safe cache key generators
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
  custom: (namespace: "analytics", identifier: string, subResource?: string): CacheKey,
};
```

### Usage Patterns
```typescript
// ✅ Create ready-to-use cache service
const cache = await createCacheService();

// ✅ Direct cache operations
await cache.set(createCacheKey.user.profile("123"), userData, 300000);
const user = await cache.get<User>(createCacheKey.user.profile("123"));

// ✅ Cache-aside pattern
const data = await cache.withCache(
  () => fetchFromDB(id),
  createCacheKey.environment.state(id),
  300000 // 5 minutes
);

// ✅ Multiple key deletion
await cache.del([
  createCacheKey.user.profile("123"),
  createCacheKey.user.preferences("123")
]);
```

## Build Configuration

### Package.json Scripts
- **`clean`**: Remove build artifacts
- **`lint`**: ESLint with TypeScript-aware rules
- **`test`**: Run unit tests with Vitest
- **`test:coverage`**: Generate coverage report
- **`build`**: TypeScript compilation + Vite build
- **`go`**: Development watch mode

### Turbo Dependencies
```json
"@formbricks/cache#lint": { "dependsOn": ["@formbricks/logger#build"] },
"@formbricks/cache#test": { "dependsOn": ["@formbricks/logger#build"] },
"@formbricks/cache#test:coverage": { "dependsOn": ["@formbricks/logger#build"] },
"@formbricks/cache#build": { "dependsOn": ["@formbricks/logger#build"] }
"@formbricks/cache#go": { "dependsOn": ["@formbricks/logger#build"] }
```