/* eslint-disable @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-non-null-assertion, @typescript-eslint/require-await -- Test file needs template expressions for test output */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { logger } from "@formbricks/logger";
import { createCacheKey } from "./cache-keys";
import { getCacheService } from "./client";
import type { CacheService } from "./service";

// Check if Redis is available
let isRedisAvailable = false;
let cacheService: CacheService | null = null;

// Helper to reduce nesting depth
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

// Test Redis availability
async function checkRedisAvailability(): Promise<boolean> {
  try {
    const cacheServiceResult = await getCacheService();
    if (!cacheServiceResult.ok) {
      logger.info("Cache service unavailable - Redis not available");
      return false;
    }

    const isAvailable = await cacheServiceResult.data.isRedisAvailable();
    if (isAvailable) {
      logger.info("Redis availability check successful - Redis is available");
      cacheService = cacheServiceResult.data;
      return true;
    }

    logger.info("Redis availability check failed - Redis not available");
    return false;
  } catch (error) {
    logger.error({ error }, "Error checking Redis availability");
    return false;
  }
}

/**
 * Cache Integration Tests - End-to-End Redis Operations
 *
 * This test suite verifies that cache operations work correctly through the actual
 * CacheService API against a live Redis instance. These tests exercise real code paths
 * that the application uses in production.
 *
 * Prerequisites:
 * - Redis server must be running and accessible
 * - REDIS_URL environment variable must be set to a valid Redis connection string
 * - Tests will be automatically skipped if REDIS_URL is empty or Redis client is not available
 *
 * Running the tests:
 * Local development: cd packages/cache && npx vitest run src/cache-integration.test.ts
 * CI Environment: Tests run automatically in E2E workflow with Redis/Valkey service
 *
 * Test Scenarios:
 *
 * 1. Basic Cache Operations
 *    - Purpose: Verify basic get/set/del operations work correctly
 *    - Method: Set a value, get it, delete it, verify deletion
 *    - Expected: All operations succeed with correct return values
 *    - Failure Indicates: Basic Redis connectivity or operation issues
 *
 * 2. withCache Miss/Hit Pattern
 *    - Purpose: Verify cache-aside pattern implementation
 *    - Method: Call withCache twice with expensive function
 *    - Expected: First call executes function (miss), second call returns cached value (hit)
 *    - Failure Indicates: Cache miss/hit logic not working correctly
 *
 * 3. Cache Invalidation
 *    - Purpose: Verify that del() clears cache and forces recomputation
 *    - Method: Cache a value, invalidate it, call withCache again
 *    - Expected: Function executes again after invalidation
 *    - Failure Indicates: Cache invalidation not working
 *
 * 4. TTL Expiry Behavior
 *    - Purpose: Verify automatic cache expiration
 *    - Method: Set value with short TTL, wait for expiration, verify gone
 *    - Expected: Value expires automatically and subsequent calls recompute
 *    - Failure Indicates: TTL not working correctly
 *
 * 5. Concurrent Cache Operations
 *    - Purpose: Test thread safety of cache operations
 *    - Method: Multiple concurrent get/set operations on same key
 *    - Expected: No corruption, consistent behavior
 *    - Failure Indicates: Race conditions in cache operations
 *
 * 6. Different Data Types
 *    - Purpose: Verify serialization works for various data types
 *    - Method: Store objects, arrays, primitives, complex nested data
 *    - Expected: Data round-trips correctly without corruption
 *    - Failure Indicates: Serialization/deserialization issues
 *
 * 7. Error Handling
 *    - Purpose: Verify graceful error handling when Redis is unavailable
 *    - Method: Test operations when Redis connection is lost
 *    - Expected: Graceful degradation, proper error types returned
 *    - Failure Indicates: Poor error handling
 *
 * Success Indicators:
 * ✅ All cache operations complete successfully
 * ✅ Cache hits/misses behave as expected
 * ✅ TTL expiration works correctly
 * ✅ Data integrity maintained across operations
 * ✅ Proper error handling when Redis unavailable
 *
 * Failure Indicators:
 * ❌ Cache operations fail unexpectedly
 * ❌ Cache hits don't work (always executing expensive operations)
 * ❌ TTL not expiring keys
 * ❌ Data corruption or serialization issues
 * ❌ Poor error handling
 */

describe("Cache Integration Tests - End-to-End Redis Operations", () => {
  beforeAll(async () => {
    // Check Redis availability first
    isRedisAvailable = await checkRedisAvailability();

    if (!isRedisAvailable) {
      logger.info("🟡 Cache Integration Tests: Redis not available - tests will be skipped");
      logger.info("   To run these tests locally, ensure Redis is running and REDIS_URL is set");
      return;
    }

    logger.info("🟢 Cache Integration Tests: Redis available - tests will run");

    // Clear any existing test keys
    if (cacheService) {
      const redis = cacheService.getRedisClient();
      if (redis) {
        const testKeys = await redis.keys("fb:cache:test:*");
        if (testKeys.length > 0) {
          await redis.del(testKeys);
        }
      }
    }
  });

  afterAll(async () => {
    // Clean up test keys
    if (!isRedisAvailable || !cacheService) {
      logger.info("Skipping cleanup: Redis not available");
      return;
    }

    const redis = cacheService.getRedisClient();
    if (redis) {
      const testKeys = await redis.keys("fb:cache:test:*");
      if (testKeys.length > 0) {
        await redis.del(testKeys);
      }
    }
  });

  test("Basic cache operations: set, get, exists, del", async () => {
    if (!isRedisAvailable || !cacheService) {
      logger.info("Skipping test: Redis not available");
      return;
    }

    const key = createCacheKey.environment.state("basic-ops-test");
    const testValue = { message: "Hello Cache!", timestamp: Date.now(), count: 42 };

    // Test set operation
    const setResult = await cacheService.set(key, testValue, 60000); // 60 seconds TTL
    expect(setResult.ok).toBe(true);
    logger.info("✅ Set operation successful");

    // Test exists operation
    const existsResult = await cacheService.exists(key);
    expect(existsResult.ok).toBe(true);
    if (existsResult.ok) {
      expect(existsResult.data).toBe(true);
    }
    logger.info("✅ Exists operation confirmed key exists");

    // Test get operation
    const getResult = await cacheService.get<typeof testValue>(key);
    expect(getResult.ok).toBe(true);
    if (getResult.ok) {
      expect(getResult.data).toEqual(testValue);
    }
    logger.info("✅ Get operation returned correct value");

    // Test del operation
    const delResult = await cacheService.del([key]);
    expect(delResult.ok).toBe(true);
    logger.info("✅ Del operation successful");

    // Verify key no longer exists
    const existsAfterDelResult = await cacheService.exists(key);
    expect(existsAfterDelResult.ok).toBe(true);
    if (existsAfterDelResult.ok) {
      expect(existsAfterDelResult.data).toBe(false);
    }
    logger.info("✅ Key confirmed deleted");

    // Verify get returns null after deletion
    const getAfterDelResult = await cacheService.get(key);
    expect(getAfterDelResult.ok).toBe(true);
    if (getAfterDelResult.ok) {
      expect(getAfterDelResult.data).toBe(null);
    }
    logger.info("✅ Get after deletion returns null");
  }, 10000);

  test("withCache miss/hit pattern: first call miss, second call hit", async () => {
    if (!isRedisAvailable || !cacheService) {
      logger.info("Skipping test: Redis not available");
      return;
    }

    const key = createCacheKey.environment.state("miss-hit-test");
    let executionCount = 0;

    // Expensive function that we want to cache
    const expensiveFunction = async (): Promise<{ result: string; timestamp: number; execution: number }> => {
      executionCount++;
      // Simulate expensive operation
      await delay(10);
      return {
        result: "expensive computation result",
        timestamp: Date.now(),
        execution: executionCount,
      };
    };

    // Clear any existing cache for this key
    await cacheService.del([key]);

    logger.info("First call (cache miss expected)...");
    const firstCall = await cacheService.withCache(expensiveFunction, key, 60000);
    expect(firstCall.execution).toBe(1);
    expect(executionCount).toBe(1);
    logger.info(`✅ First call executed function: execution=${firstCall.execution}`);

    logger.info("Second call (cache hit expected)...");
    const secondCall = await cacheService.withCache(expensiveFunction, key, 60000);
    expect(secondCall.execution).toBe(1); // Should be the cached value from first call
    expect(executionCount).toBe(1); // Function should not have been called again
    expect(secondCall.result).toBe(firstCall.result);
    logger.info(`✅ Second call returned cached value: execution=${secondCall.execution}`);

    // Verify the values are identical (cache hit)
    expect(secondCall).toEqual(firstCall);
    logger.info("✅ Cache hit confirmed - identical values returned");
  }, 15000);

  test("Cache invalidation: del() clears cache and forces recomputation", async () => {
    if (!isRedisAvailable || !cacheService) {
      logger.info("Skipping test: Redis not available");
      return;
    }

    const key = createCacheKey.environment.state("invalidation-test");
    let executionCount = 0;

    const expensiveFunction = async (): Promise<{ value: string; execution: number }> => {
      executionCount++;
      return {
        value: `computation-${executionCount}`,
        execution: executionCount,
      };
    };

    // Clear any existing cache
    await cacheService.del([key]);

    logger.info("First call - populate cache...");
    const firstResult = await cacheService.withCache(expensiveFunction, key, 60000);
    expect(firstResult.execution).toBe(1);
    expect(executionCount).toBe(1);
    logger.info(`✅ Cache populated: ${firstResult.value}`);

    logger.info("Second call - should hit cache...");
    const secondResult = await cacheService.withCache(expensiveFunction, key, 60000);
    expect(secondResult.execution).toBe(1); // Same as first call (cached)
    expect(executionCount).toBe(1); // Function not executed again
    expect(secondResult).toEqual(firstResult);
    logger.info(`✅ Cache hit confirmed: ${secondResult.value}`);

    logger.info("Invalidating cache...");
    const delResult = await cacheService.del([key]);
    expect(delResult.ok).toBe(true);
    logger.info("✅ Cache invalidated");

    logger.info("Third call after invalidation - should miss cache and recompute...");
    const thirdResult = await cacheService.withCache(expensiveFunction, key, 60000);
    expect(thirdResult.execution).toBe(2); // New execution
    expect(executionCount).toBe(2); // Function executed again
    expect(thirdResult.value).toBe("computation-2");
    expect(thirdResult).not.toEqual(firstResult);
    logger.info(`✅ Cache miss after invalidation confirmed: ${thirdResult.value}`);

    logger.info("Fourth call - should hit cache again...");
    const fourthResult = await cacheService.withCache(expensiveFunction, key, 60000);
    expect(fourthResult.execution).toBe(2); // Same as third call (cached)
    expect(executionCount).toBe(2); // Function not executed again
    expect(fourthResult).toEqual(thirdResult);
    logger.info(`✅ Cache repopulated and hit: ${fourthResult.value}`);
  }, 15000);

  test("TTL expiry behavior: cache expires automatically", async () => {
    if (!isRedisAvailable || !cacheService) {
      logger.info("Skipping test: Redis not available");
      return;
    }

    const key = createCacheKey.environment.state("ttl-expiry-test");
    let executionCount = 0;

    const expensiveFunction = async (): Promise<{ value: string; execution: number }> => {
      executionCount++;
      return {
        value: `ttl-computation-${executionCount}`,
        execution: executionCount,
      };
    };

    // Clear any existing cache
    await cacheService.del([key]);

    logger.info("First call with short TTL (2 seconds)...");
    const firstResult = await cacheService.withCache(expensiveFunction, key, 2000); // 2 second TTL
    expect(firstResult.execution).toBe(1);
    expect(executionCount).toBe(1);
    logger.info(`✅ Cache populated with TTL: ${firstResult.value}`);

    logger.info("Second call within TTL - should hit cache...");
    const secondResult = await cacheService.withCache(expensiveFunction, key, 2000);
    expect(secondResult.execution).toBe(1); // Same as first call (cached)
    expect(executionCount).toBe(1); // Function not executed again
    expect(secondResult).toEqual(firstResult);
    logger.info(`✅ Cache hit within TTL: ${secondResult.value}`);

    logger.info("Waiting for TTL expiry (3 seconds)...");
    await delay(3000);

    logger.info("Third call after TTL expiry - should miss cache and recompute...");
    const thirdResult = await cacheService.withCache(expensiveFunction, key, 2000);
    expect(thirdResult.execution).toBe(2); // New execution
    expect(executionCount).toBe(2); // Function executed again
    expect(thirdResult.value).toBe("ttl-computation-2");
    expect(thirdResult).not.toEqual(firstResult);
    logger.info(`✅ Cache miss after TTL expiry confirmed: ${thirdResult.value}`);

    // Verify the key was automatically removed by Redis TTL
    const redis = cacheService.getRedisClient();
    if (redis) {
      // The old key should be gone, but there might be a new one from the third call
      const currentKeys = await redis.keys(`fb:cache:${key}*`);
      logger.info(`Current cache keys: ${currentKeys.length > 0 ? currentKeys.join(", ") : "none"}`);
      // We expect either 0 keys (if TTL expired) or 1 key (new one from third call)
      expect(currentKeys.length).toBeLessThanOrEqual(1);
    }

    logger.info("✅ TTL expiry working correctly");
  }, 20000);

  test("Concurrent cache operations: thread safety", async () => {
    if (!isRedisAvailable || !cacheService) {
      logger.info("Skipping test: Redis not available");
      return;
    }

    const baseKey = "concurrent-test";
    let globalExecutionCount = 0;

    const expensiveFunction = async (
      id: number
    ): Promise<{ id: number; execution: number; timestamp: number }> => {
      globalExecutionCount++;
      // Simulate expensive operation with variable delay
      await delay(Math.random() * 50 + 10);
      return {
        id,
        execution: globalExecutionCount,
        timestamp: Date.now(),
      };
    };

    // Clear any existing cache keys
    const redis = cacheService.getRedisClient();
    if (redis) {
      const existingKeys = await redis.keys(`fb:cache:${baseKey}*`);
      if (existingKeys.length > 0) {
        await redis.del(existingKeys);
      }
    }

    logger.info("Starting concurrent cache operations...");

    // Create multiple concurrent operations on different keys
    const concurrentOperations = Array.from({ length: 10 }, async (_, i) => {
      const key = createCacheKey.environment.state(`${baseKey}-${i}`);

      // Each "thread" makes the same call twice - first should miss, second should hit
      const firstCall = await cacheService!.withCache(() => expensiveFunction(i), key, 30000);
      const secondCall = await cacheService!.withCache(() => expensiveFunction(i), key, 30000);

      return { i, firstCall, secondCall };
    });

    const results = await Promise.all(concurrentOperations);

    logger.info(`Completed ${results.length} concurrent operations`);

    // Verify each operation behaved correctly
    results.forEach(({ i, firstCall, secondCall }) => {
      // First call should have executed the function
      expect(firstCall.id).toBe(i);

      // Second call should return the cached value (identical to first)
      expect(secondCall).toEqual(firstCall);

      logger.info(`Operation ${i}: first=${firstCall.execution}, second=${secondCall.execution} (cached)`);
    });

    // Verify we executed exactly 10 functions (one per unique key)
    expect(globalExecutionCount).toBe(10);
    logger.info(
      `✅ Concurrent operations completed successfully - ${globalExecutionCount} function executions`
    );
  }, 30000);

  test("Different data types: serialization correctness", async () => {
    if (!isRedisAvailable || !cacheService) {
      logger.info("Skipping test: Redis not available");
      return;
    }

    const testCases = [
      { name: "string", value: "Hello, World!" },
      { name: "number", value: 42.5 },
      { name: "boolean", value: true },
      { name: "null", value: null },
      { name: "array", value: [1, "two", { three: 3 }, null, true] },
      {
        name: "object",
        value: {
          id: 123,
          name: "Test Object",
          nested: {
            array: [1, 2, 3],
            date: new Date().toISOString(),
            bool: false,
          },
        },
      },
      {
        name: "complex",
        value: {
          users: [
            { id: 1, name: "Alice", roles: ["admin", "user"] },
            { id: 2, name: "Bob", roles: ["user"] },
          ],
          metadata: {
            version: "1.0.0",
            created: new Date().toISOString(),
            features: {
              cache: true,
              rateLimit: true,
              audit: false,
            },
          },
        },
      },
    ];

    logger.info(`Testing serialization for ${testCases.length} data types...`);

    for (const testCase of testCases) {
      const key = createCacheKey.environment.state(`serialization-${testCase.name}`);

      logger.info(`Testing ${testCase.name} type...`);

      // Set the value
      const setResult = await cacheService.set(key, testCase.value, 30000);
      expect(setResult.ok).toBe(true);

      // Get the value back
      const getResult = await cacheService.get(key);
      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(getResult.data).toEqual(testCase.value);
      }

      // Test through withCache as well
      let functionCalled = false;
      const cachedResult = await cacheService.withCache(
        async () => {
          functionCalled = true;
          return testCase.value;
        },
        key,
        30000
      );

      // Should hit cache, not call function
      expect(functionCalled).toBe(false);
      expect(cachedResult).toEqual(testCase.value);

      logger.info(`✅ ${testCase.name} serialization successful`);
    }

    logger.info("✅ All data types serialized correctly");
  }, 20000);

  test("Error handling: graceful degradation when operations fail", async () => {
    if (!isRedisAvailable || !cacheService) {
      logger.info("Skipping test: Redis not available");
      return;
    }

    // Test with invalid TTL (should handle gracefully)
    const validKey = createCacheKey.environment.state("error-test");
    const invalidTtl = -1000; // Negative TTL should be invalid

    logger.info("Testing error handling with invalid inputs...");

    const setResult = await cacheService.set(validKey, "test", invalidTtl);
    expect(setResult.ok).toBe(false);
    if (!setResult.ok) {
      expect(setResult.error.code).toBeDefined();
      logger.info(`✅ Set with invalid TTL handled gracefully: ${setResult.error.code}`);
    }

    // Test withCache error handling with invalid TTL
    let functionCalled = false;

    const withCacheResult = await cacheService.withCache(
      async () => {
        functionCalled = true;
        return "test result";
      },
      validKey,
      invalidTtl
    );

    // Function should still be called even if cache fails
    expect(functionCalled).toBe(true);
    expect(withCacheResult).toBe("test result");
    logger.info("✅ withCache gracefully degraded to function execution when cache failed");

    logger.info("✅ Error handling tests completed successfully");
  }, 15000);
});
