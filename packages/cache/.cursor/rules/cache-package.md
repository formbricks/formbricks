# @formbricks/cache Package Rules

## Package Overview
This is the unified Redis cache package for Formbricks. It will centralize all caching operations into a single, Redis-backed solution, replacing the previous dual Redis/in-memory setup.

## Architecture Principles (Implemented in Task 1)

### 1. Redis-Only Strategy
- **Mandatory Redis**: All deployments MUST use Redis. No fallback to in-memory caching.
- **Environment-driven**: Redis connection configured via `REDIS_URL` environment variable only.

### 2. Type Safety
- **Strict TypeScript**: All code must pass strict TypeScript compilation.
- **Explicit Types**: Prefer explicit type annotations over inference for public APIs.

### 3. Dependency Injection
- **Redis Client Injection**: Accept Redis client as parameter for testability.
- **Factory Pattern**: Use factory functions for service creation.

## Code Standards

### File Organization (Current Implementation)
```
src/
├── index.ts          # Main exports
├── factory.ts        # Redis client and service factory
└── *.test.ts         # Unit tests (collocated with source)
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

// ✅ GOOD - Import from package root
import { createCacheService } from "@formbricks/cache";

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
- **85% Coverage**: Every public function must have unit tests.
- **Collocated Tests**: Place `*.test.ts` files next to source files.
- **Mock External Dependencies**: Mock Redis client and logger in tests.
- **Test Edge Cases**: Include error conditions, empty responses, connection failures.

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

### Usage Patterns
```typescript
// ✅ Basic client creation
const client = createRedisClientFromEnv(); // Requires REDIS_URL env var

// ✅ Service creation with environment client
const service = await createCacheService();

// ✅ Service creation with custom client (for testing)
const service = await createCacheService(mockClient);
```
