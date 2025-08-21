# @formbricks/cache Package Rules

## Package Overview
This is the unified Redis cache package for Formbricks. It will centralize all caching operations into a single, Redis-backed solution, replacing the previous dual Redis/in-memory setup.

## Architecture Principles

### 1. Redis-Only Strategy
- **Mandatory Redis**: All deployments MUST use Redis. No fallback to in-memory caching.
- **Environment-driven**: Redis connection configured via `REDIS_URL` environment variable only.

### 2. Type Safety
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

### 4. Dependency Injection
- **Redis Client Injection**: Accept Redis client as parameter for testability.
- **Factory Pattern**: Use factory functions for service creation.

## Code Standards

### File Organization (Current Implementation)
```text
src/
├── index.ts          # Main exports
├── factory.ts        # Redis client and service factory
├── cache-keys.ts     # Cache key generators with branded types
├── utils/
│   ├── key.ts        # makeCacheKey utility with runtime validation
│   └── key.test.ts   # Tests for makeCacheKey utility
└── *.test.ts         # Unit tests (collocated with source)
types/
├── keys.ts           # Branded CacheKey type & CustomCacheNamespace
└── *.test.ts         # Type tests
```

### Naming Conventions
- **Functions**: Use camelCase (e.g., `createCacheService`, `getCacheKey`)
- **Types**: Use PascalCase (e.g., `RedisClient`, `CacheKey`)
- **Constants**: Use UPPER_SNAKE_CASE (e.g., `CACHE_PACKAGE_VERSION`)
- **Files**: Use kebab-case for multi-word files (e.g., `cache-keys.ts`)

### Import/Export Patterns (Implemented)
```typescript
// ✅ GOOD - Named exports from index.ts
export { createCacheService, createRedisClientFromEnv, type RedisClient } from "./factory";
export { createCacheKey } from "./cache-keys";
export type { CacheKey } from "../types/keys";

// ✅ GOOD - Import from package root
import { createCacheService, createCacheKey } from "@formbricks/cache";

// ❌ BAD - Deep imports
import { createCacheService } from "@formbricks/cache/dist/factory";
```

## Error Handling

### Redis Connection Errors
- **Graceful Failures**: Log errors but allow application to continue where possible.
- **Reconnection Strategy**: Implement exponential backoff with persistent retry.
- **Clear Error Messages**: Include context in error messages for debugging.

```typescript
// ✅ GOOD
try {
  await client.connect();
} catch (err) {
  logger.error("Initial Redis connection failed:", err);
  throw new Error(`Failed to connect to Redis: ${err instanceof Error ? err.message : 'Unknown error'}`);
}
```

## Testing Standards

### Unit Test Requirements
- **Comprehensive Coverage**: All public functions and utilities must have thorough unit tests.
- **Collocated Tests**: Place `*.test.ts` files next to source files.
- **Mock External Dependencies**: Mock Redis client and logger in tests.
- **Test Edge Cases**: Include error conditions, empty responses, connection failures.
- **Validation Testing**: Test all runtime validation scenarios (empty parts, invalid structures).
- **Type Safety Testing**: Verify branded types work correctly across all scenarios.
- **Integration Testing**: Test internal integration between utilities and main functions.

### Test Structure
```typescript
// ✅ GOOD - Descriptive test structure
describe("createCacheService", () => {
  test("should create service with provided client", async () => {
    // Test implementation
  });
  
  test("should connect client if not open", async () => {
    // Test implementation
  });
});
```

### Mock Patterns
```typescript
// ✅ GOOD - Proper mock interface
interface MockRedisClient {
  isOpen: boolean;
  on: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
}

// ✅ GOOD - Type-safe casting
const mockClient = mockRedisClient as unknown as RedisClient;
```

## Performance Guidelines (Implemented)

### Connection Management
- **Reconnection Strategy**: Exponential backoff for first 5 attempts (max 5s), then 30s intervals.
- **Connection Events**: Comprehensive logging for all Redis connection events.
- **Lazy Connection**: Connect only when needed via `createCacheService`.

## Security Requirements (Implemented)

### Access Control
- **Environment Variables**: Use `REDIS_URL` for connection configuration.
- **No Hardcoded Credentials**: Never commit credentials to code.
- **Error Handling**: Throw clear errors when `REDIS_URL` is missing.

## Migration Guidelines (Planned)

### From Legacy Cache
- **Future Implementation**: Will replace `apps/web/modules/cache/` completely.
- **API Compatibility**: Future cache service will maintain existing cache operation patterns.

## Logging Standards (Implemented)

### Log Levels
- **info**: Connection status, reconnection attempts
- **error**: Connection failures, Redis client errors

### Log Format (Current Implementation)
```typescript
// Connection logging
logger.info("Redis client connected");
logger.info(`Redis reconnection attempt ${String(retries)}`);
logger.error("Redis client error:", err);
logger.error("Initial Redis connection failed:", err);
```

## Dependencies (Current Implementation)

### Production Dependencies
- **`redis@5.8.1`**: Official Redis client 
- **`@formbricks/logger`**: Internal logging package

### Development Dependencies
- **`@formbricks/config-typescript`**: Shared TypeScript config
- **`@formbricks/eslint-config`**: Shared ESLint config
- **`vite`**: Build tool for ES/CJS output
- **`vitest`**: Testing framework
- **`@vitest/coverage-v8`**: Coverage reporting

## Build and Deployment

### Package Configuration
- **ES Modules**: Primary export format (`"type": "module"`)
- **CommonJS**: Secondary for compatibility
- **Type Definitions**: Generated via `vite-plugin-dts`
- **External Dependencies**: `redis` and `@formbricks/logger` externalized in build

### Turbo Configuration (Added)
```json
"@formbricks/cache#lint": {
  "dependsOn": ["@formbricks/logger#build"]
},
"@formbricks/cache#test": {
  "dependsOn": ["@formbricks/logger#build"]
},
"@formbricks/cache#test:coverage": {
  "dependsOn": ["@formbricks/logger#build"]
}
```

## API

### Factory Functions
```typescript
// Create Redis client from environment
export function createRedisClientFromEnv(): RedisClient;

// Create cache service with optional client injection
export async function createCacheService(redis?: RedisClient): Promise<RedisClient>;

// Redis client type export
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
// ✅ Basic client creation
const client = createRedisClientFromEnv(); // Requires REDIS_URL env var

// ✅ Service creation with environment client
const service = await createCacheService();

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

## Validation Standards

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