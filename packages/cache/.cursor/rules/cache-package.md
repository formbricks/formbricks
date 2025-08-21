# @formbricks/cache Package Rules

## Package Overview
Unified Redis cache package for Formbricks. Provides a type-safe, Redis-only caching solution with comprehensive validation and error handling.

## Architecture Principles

### 1. Redis-Only Strategy
- **Mandatory Redis**: All deployments MUST use Redis. No fallback to in-memory caching.
- **Environment-driven**: Redis connection configured via `REDIS_URL` environment variable only.

### 2. Type Safety & Validation
- **Strict TypeScript**: All code must pass strict TypeScript compilation.
- **Explicit Types**: Prefer explicit type annotations over inference for public APIs.
- **Branded Cache Keys**: Use `CacheKey` branded type to prevent raw string usage.
- **Compile-time Safety**: TypeScript prevents using raw strings where `CacheKey` is expected.

### 3. Runtime Validation
- **makeCacheKey Utility**: Internal utility function provides runtime validation for all cache keys.
- **Structure Validation**: Regex patterns validate cache key format (`fb:resource:identifier[:subresource]*`).
- **Empty Parts Prevention**: Throws errors for empty parts to prevent malformed keys.
- **Consistent Error Messages**: All validation errors use standardized error messages.
- **Type-safe Namespace**: `CustomCacheNamespace` union type restricts valid custom namespaces.
- **Zod Validation**: Runtime validation using Zod schemas for cache keys and TTL values.
- **Custom Error Types**: `CacheValidationError` for validation failures.

### 4. Factory Pattern & Dependency Injection
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
├── utils/
│   ├── key.ts        # makeCacheKey utility with runtime validation
│   └── key.test.ts   # Tests for makeCacheKey utility
└── *.test.ts         # Unit tests (collocated with source)
types/
├── keys.ts           # Branded CacheKey type & CustomCacheNamespace
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
- **Comprehensive Coverage**: All public functions and utilities must have thorough unit tests.
- **Collocated Tests**: Place `*.test.ts` files next to source files.
- **Mock External Dependencies**: Mock Redis client and logger in tests.
- **Test Edge Cases**: Include error conditions, empty responses, connection failures.
- **Validation Testing**: Test all Zod validation schemas and runtime validation scenarios (empty parts, invalid structures).
- **Type Safety Testing**: Verify branded types work correctly across all scenarios.
- **Integration Testing**: Test internal integration between utilities and main functions.

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

### Cache Key Types and Functions
```typescript
// Branded type for type-safe cache keys
export type CacheKey = string & { readonly __brand: "CacheKey" };

// Type-safe namespace for custom cache keys
export type CustomCacheNamespace = "analytics";

// Internal utility with runtime validation (not exported)
// Located in src/utils/key.ts
const makeCacheKey = (...parts: [first: string, ...rest: string[]]): CacheKey => {
  // Automatic fb: prefix addition
  // Runtime validation with regex
  // Empty parts prevention
  // Structure validation
};

// Type-safe cache key generators (uses makeCacheKey internally)
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

### Usage Patterns
```typescript
// ✅ Create ready-to-use cache service
const cache = await createCacheService();

// ✅ Direct cache operations
await cache.set(createCacheKey.environment.config("env-123"), envData, 7200000); // 2 hours
const config = await cache.get<EnvironmentConfig>(createCacheKey.environment.config("env-123"));

// ✅ Cache-aside pattern
const data = await cache.withCache(
  () => fetchFromDB(id),
  createCacheKey.environment.state(id),
  7200000 // 2 hours
);

// ✅ Multiple key deletion
await cache.del([
  createCacheKey.environment.config("env-123"),
  createCacheKey.environment.segments("env-123")
]);

// ✅ Service creation with custom client (for testing)
const service = await createCacheService(mockClient);

// ✅ Type-safe cache key generation with automatic validation
const envKey = createCacheKey.environment.state("env-123");
// Result: "fb:env:env-123:state" (CacheKey type)

const rateLimitKey = createCacheKey.rateLimit.core("api", "user-456", 1640995200);
// Result: "fb:rate_limit:api:user-456:1640995200" (CacheKey type)

const customKey = createCacheKey.custom("analytics", "user-789", "daily-stats");
// Result: "fb:analytics:user-789:daily-stats" (CacheKey type)

// ✅ Runtime validation prevents errors
const customKeyNoSub = createCacheKey.custom("analytics", "user-xyz");
// Result: "fb:analytics:user-xyz" (CacheKey type)

// ❌ Runtime validation catches errors
createCacheKey.environment.state(""); 
// Throws: "Invalid Cache key: Parts cannot be empty"

createCacheKey.custom("analytics", "user-123", "");
// Throws: "Invalid Cache key: Parts cannot be empty"

// ❌ TypeScript prevents invalid namespaces at compile time
createCacheKey.custom("invalid", "user-123"); 
// TypeScript Error: Argument of type '"invalid"' is not assignable to parameter of type 'CustomCacheNamespace'
```

### makeCacheKey Utility Principles

- **Location**: Internal utility in `src/utils/key.ts` - not exported from package
- **Purpose**: Provides consistent runtime validation for all cache key generation
- **Structure**: Validates `fb:resource:identifier[:subresource]*` pattern with regex
- **Error Handling**: Throws descriptive errors for validation failures

### Validation Rules

```typescript
// ✅ GOOD - Valid cache key patterns
makeCacheKey("env", "123", "state")           // "fb:env:123:state"
makeCacheKey("user", "456")                   // "fb:user:456"
makeCacheKey("rate_limit", "api", "user", "123") // "fb:rate_limit:api:user:123"

// ❌ BAD - Invalid patterns that throw errors
makeCacheKey("fb", "test")                    // Error: Don't include 'fb' prefix
makeCacheKey("env", "", "state")              // Error: Parts cannot be empty
makeCacheKey("")                              // Error: Parts cannot be empty
```

### CustomCacheNamespace Management

- **Type Definition**: Located in `types/keys.ts` as union type
- **Current Namespaces**: `"analytics"`
- **Extension**: Add new namespaces to union type as needed
- **Validation**: TypeScript enforces valid namespaces at compile time

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
"@formbricks/cache#build": { "dependsOn": ["@formbricks/logger#build"] },
"@formbricks/cache#go": { "dependsOn": ["@formbricks/logger#build"] }
```
