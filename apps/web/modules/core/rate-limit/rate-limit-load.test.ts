import redis from "@/modules/cache/redis";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { applyRateLimit } from "./helpers";
import { checkRateLimit } from "./rate-limit";
import { TRateLimitConfig } from "./types/rate-limit";

// Check if Redis is actually available (not just client object exists)
const isRedisAvailable = redis && process.env.REDIS_URL;

/**
 * Rate Limiter Load Tests - Race Condition Detection
 *
 * This test suite verifies that the rate limiter implementation is free from race conditions
 * and handles high concurrency correctly. The rate limiter uses Redis with Lua scripts for
 * atomic operations to prevent race conditions in multi-pod Kubernetes environments.
 *
 * Prerequisites:
 * - Redis server must be running and accessible
 * - REDIS_URL environment variable must be set
 * - Tests will be automatically skipped if Redis is not available (e.g., in CI environments)
 *
 * Running the tests:
 * cd apps/web && npx vitest run modules/core/rate-limit/rate-limit-load.test.ts
 *
 * Note: If Redis is not available or REDIS_URL is not set, all tests in this suite will be skipped gracefully
 *
 * Test Scenarios:
 *
 * 1. Basic Race Condition Test
 *    - Purpose: Verify atomic operations under high concurrency
 *    - Method: Send 20 concurrent requests to the same identifier (limit: 3)
 *    - Expected: Exactly 3 requests allowed, 17 denied
 *    - Failure Indicates: Race conditions in the Redis Lua script
 *
 * 2. Multiple Waves Test
 *    - Purpose: Test consistency across multiple request waves
 *    - Method: Send 3 waves of 15 concurrent requests each (limit: 10)
 *    - Expected: Exactly 10 requests allowed total across all waves
 *    - Failure Indicates: Window boundary issues or counter corruption
 *
 * 3. Different Identifiers Test
 *    - Purpose: Ensure identifiers don't interfere with each other
 *    - Method: 5 different identifiers, 10 requests each (limit: 3 per identifier)
 *    - Expected: Each identifier gets exactly 3 allowed requests
 *    - Failure Indicates: Key collision or identifier mixing
 *
 * 4. Window Boundary Test
 *    - Purpose: Verify correct window expiration and reset
 *    - Method: Send requests, wait for window expiry, send more requests
 *    - Expected: Fresh limits after window expiry
 *    - Failure Indicates: TTL or window calculation issues
 *
 * 5. High Throughput Stress Test
 *    - Purpose: Test performance under sustained load
 *    - Method: 200 requests in batches (limit: 50)
 *    - Expected: Exactly 50 requests allowed, consistent performance
 *    - Failure Indicates: Performance degradation or counter corruption
 *
 * 6. applyRateLimit Function Test
 *    - Purpose: Test the higher-level wrapper function
 *    - Method: Concurrent requests using applyRateLimit instead of checkRateLimit
 *    - Expected: Exact limit compliance with proper error handling
 *    - Failure Indicates: Issues in the wrapper function logic
 *
 * 7. Mixed Identifier Patterns Test
 *    - Purpose: Test real-world identifier patterns under load
 *    - Method: Different identifier formats running concurrently
 *    - Expected: Each pattern respects its individual limits
 *    - Failure Indicates: Pattern-specific issues
 *
 * 8. TTL Expiration Test
 *    - Purpose: Verify that rate limit keys expire correctly and unblock requests
 *    - Method: Hit rate limit, wait for TTL expiration, verify unblocking
 *    - Expected: Keys expire automatically, fresh limits after expiration
 *    - Failure Indicates: TTL not working, keys not expiring, memory leaks
 *
 * Success Indicators:
 * ✅ Exact limit compliance (no more, no less than configured limit)
 * ✅ Consistent behavior across multiple runs
 * ✅ No interference between different identifiers
 * ✅ Proper window reset behavior
 *
 * Failure Indicators:
 * ❌ More requests allowed than limit: Race condition in increment
 * ❌ Fewer requests allowed than limit: Lock contention or failed operations
 * ❌ Identifier interference: Key collision or namespace issues
 * ❌ Window boundary failures: TTL or timestamp calculation errors
 */

// Check Redis availability and log status
if (!isRedisAvailable) {
  console.log("🟡 Rate Limiter Load Tests: Redis not available - tests will be skipped");
  if (!process.env.REDIS_URL) {
    console.log("   Reason: REDIS_URL environment variable not set");
  } else if (!redis) {
    console.log("   Reason: Redis client not initialized");
  } else {
    console.log("   Reason: Redis connection may not be available");
  }
  console.log("   To run these tests, ensure Redis is running and REDIS_URL is set");
} else {
  console.log("🟢 Rate Limiter Load Tests: Redis available - tests will run");
}

// Test configurations
const TEST_CONFIGS = {
  // Very restrictive for race condition testing
  strict: {
    interval: 5, // 5 seconds
    allowedPerInterval: 3,
    namespace: "test:strict",
  } as TRateLimitConfig,

  // Medium restrictive
  medium: {
    interval: 10,
    allowedPerInterval: 10,
    namespace: "test:medium",
  } as TRateLimitConfig,

  // High throughput
  high: {
    interval: 5,
    allowedPerInterval: 50,
    namespace: "test:high",
  } as TRateLimitConfig,
} as const;

describe.skipIf(!isRedisAvailable)("Rate Limiter Load Tests - Race Conditions", () => {
  beforeAll(async () => {
    // This will only run if Redis is available
    try {
      // Test Redis connection with a ping
      await redis!.ping();

      // Clear any existing test keys
      const testKeys = await redis!.keys("fb:rate_limit:test:*");
      if (testKeys.length > 0) {
        await redis!.del(...testKeys);
      }
    } catch (error) {
      throw new Error(`Redis connection failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }, 15000); // 15 second timeout for setup

  afterAll(async () => {
    // Clean up test keys
    try {
      const testKeys = await redis!.keys("fb:rate_limit:test:*");
      if (testKeys.length > 0) {
        await redis!.del(...testKeys);
      }
    } catch (error) {
      console.warn(
        `Failed to cleanup test keys: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }, 10000); // 10 second timeout for cleanup

  test("Race condition test: concurrent requests to same identifier", async () => {
    const config = TEST_CONFIGS.strict;
    const identifier = "race-test-same-id";
    const concurrentRequests = 20; // More than allowed (3)

    // Create array of concurrent promises
    const promises = Array.from({ length: concurrentRequests }, () => checkRateLimit(config, identifier));

    // Execute all requests concurrently
    const results = await Promise.all(promises);

    // Count allowed vs denied requests
    const allowed = results.filter((r) => r.ok && r.data.allowed).length;
    const denied = results.filter((r) => r.ok && !r.data.allowed).length;

    console.log(`Race condition test results: ${allowed} allowed, ${denied} denied`);

    // Should allow exactly the configured limit
    expect(allowed).toBe(config.allowedPerInterval);
    expect(denied).toBe(concurrentRequests - config.allowedPerInterval);
    expect(allowed + denied).toBe(concurrentRequests);
  }, 15000);

  test("Race condition test: multiple waves of concurrent requests", async () => {
    const config = TEST_CONFIGS.medium;
    const identifier = "race-test-waves";
    const wavesCount = 3;
    const requestsPerWave = 15; // More than allowed (10)

    const allResults: any[] = [];

    // Send waves of concurrent requests (no delay to ensure same window)
    for (let wave = 0; wave < wavesCount; wave++) {
      const promises = Array.from({ length: requestsPerWave }, () => checkRateLimit(config, identifier));

      const waveResults = await Promise.all(promises);
      allResults.push(...waveResults);

      // No delay - we want all waves in the same window for this test
    }

    const totalAllowed = allResults.filter((r) => r.ok && r.data.allowed).length;
    const totalDenied = allResults.filter((r) => r.ok && !r.data.allowed).length;

    console.log(`Multi-wave test: ${totalAllowed} allowed, ${totalDenied} denied`);

    // Should still only allow the configured limit across all waves
    expect(totalAllowed).toBe(config.allowedPerInterval);
    expect(totalDenied).toBe(wavesCount * requestsPerWave - config.allowedPerInterval);
  }, 20000);

  test("Race condition test: different identifiers should not interfere", async () => {
    const config = TEST_CONFIGS.strict;
    const identifiersCount = 5;
    const requestsPerIdentifier = 10;

    // Create promises for multiple identifiers concurrently
    const allPromises: Promise<{ identifier: string; result: any }>[] = [];
    for (let i = 0; i < identifiersCount; i++) {
      const identifier = `race-test-different-${i}`;
      for (let j = 0; j < requestsPerIdentifier; j++) {
        allPromises.push(checkRateLimit(config, identifier).then((result) => ({ identifier, result })));
      }
    }

    // Execute all requests concurrently
    const results = await Promise.all(allPromises);

    // Group results by identifier
    const resultsByIdentifier = results.reduce(
      (acc, { identifier, result }) => {
        if (!acc[identifier]) acc[identifier] = [];
        acc[identifier].push(result);
        return acc;
      },
      {} as Record<string, any[]>
    );

    // Each identifier should have exactly the allowed limit
    Object.entries(resultsByIdentifier).forEach(([identifier, identifierResults]) => {
      const allowed = identifierResults.filter((r) => r.ok && r.data.allowed).length;
      const denied = identifierResults.filter((r) => r.ok && !r.data.allowed).length;

      console.log(`Identifier ${identifier}: ${allowed} allowed, ${denied} denied`);

      expect(allowed).toBe(config.allowedPerInterval);
      expect(denied).toBe(requestsPerIdentifier - config.allowedPerInterval);
    });
  }, 20000);

  test("Window boundary race condition test", async () => {
    const config = {
      interval: 2, // Very short window for testing
      allowedPerInterval: 5,
      namespace: "test:boundary",
    } as TRateLimitConfig;

    const identifier = "boundary-test";

    // First batch of requests
    const firstBatch = Array.from({ length: 8 }, () => checkRateLimit(config, identifier));

    const firstResults = await Promise.all(firstBatch);
    const firstAllowed = firstResults.filter((r) => r.ok && r.data.allowed).length;

    console.log(`First batch: ${firstAllowed} allowed`);
    expect(firstAllowed).toBe(config.allowedPerInterval);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, config.interval * 1000 + 100));

    // Second batch should get fresh limits
    const secondBatch = Array.from({ length: 8 }, () => checkRateLimit(config, identifier));

    const secondResults = await Promise.all(secondBatch);
    const secondAllowed = secondResults.filter((r) => r.ok && r.data.allowed).length;

    console.log(`Second batch: ${secondAllowed} allowed`);
    expect(secondAllowed).toBe(config.allowedPerInterval);
  }, 15000);

  test("High throughput stress test", async () => {
    const config = TEST_CONFIGS.high;
    const totalRequests = 200;
    const batchSize = 50;
    const identifier = "stress-test";

    let totalAllowed = 0;
    let totalDenied = 0;

    // Send requests in batches to simulate real load
    for (let i = 0; i < totalRequests; i += batchSize) {
      const batchEnd = Math.min(i + batchSize, totalRequests);
      const batchPromises = Array.from({ length: batchEnd - i }, () => checkRateLimit(config, identifier));

      const batchResults = await Promise.all(batchPromises);

      const batchAllowed = batchResults.filter((r) => r.ok && r.data.allowed).length;
      const batchDenied = batchResults.filter((r) => r.ok && !r.data.allowed).length;

      totalAllowed += batchAllowed;
      totalDenied += batchDenied;

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    console.log(`Stress test: ${totalAllowed} allowed, ${totalDenied} denied`);

    // Should respect the rate limit even under high load
    expect(totalAllowed).toBe(config.allowedPerInterval);
    expect(totalDenied).toBe(totalRequests - config.allowedPerInterval);
    expect(totalAllowed + totalDenied).toBe(totalRequests);
  }, 30000);

  test("applyRateLimit function race condition test", async () => {
    const config = TEST_CONFIGS.strict;
    const identifier = "apply-rate-limit-test";
    const concurrentRequests = 15;

    // Test the higher-level applyRateLimit function
    const promises = Array.from({ length: concurrentRequests }, async () => {
      try {
        await applyRateLimit(config, identifier);
        return { success: true, error: null };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    const results = await Promise.all(promises);

    const successes = results.filter((r) => r.success).length;
    const failures = results.filter((r) => !r.success).length;

    console.log(`applyRateLimit test: ${successes} successes, ${failures} failures`);

    // Should allow exactly the configured limit
    expect(successes).toBe(config.allowedPerInterval);
    expect(failures).toBe(concurrentRequests - config.allowedPerInterval);

    // All failures should be "Rate limit exceeded"
    const rateLimitErrors = results.filter((r) => r.error === "Rate limit exceeded").length;
    expect(rateLimitErrors).toBe(failures);
  }, 15000);

  test("Mixed identifier patterns under load", async () => {
    const config = TEST_CONFIGS.medium;
    const patterns = ["user-123", "ip-192.168.1.1", "api-key-abc", "session-xyz"];

    const requestsPerPattern = 15;

    // Create mixed concurrent requests
    const allPromises: Promise<{ pattern: string; result: any }>[] = [];
    for (const pattern of patterns) {
      for (let i = 0; i < requestsPerPattern; i++) {
        allPromises.push(checkRateLimit(config, pattern).then((result) => ({ pattern, result })));
      }
    }

    // Shuffle the array to simulate random request order
    for (let i = allPromises.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPromises[i], allPromises[j]] = [allPromises[j], allPromises[i]];
    }

    const results = await Promise.all(allPromises);

    // Group and verify results
    const resultsByPattern = results.reduce(
      (acc, { pattern, result }) => {
        if (!acc[pattern]) acc[pattern] = [];
        acc[pattern].push(result);
        return acc;
      },
      {} as Record<string, any[]>
    );

    Object.entries(resultsByPattern).forEach(([pattern, patternResults]) => {
      const allowed = patternResults.filter((r) => r.ok && r.data.allowed).length;
      const denied = patternResults.filter((r) => r.ok && !r.data.allowed).length;

      console.log(`Pattern ${pattern}: ${allowed} allowed, ${denied} denied`);

      expect(allowed).toBe(config.allowedPerInterval);
      expect(denied).toBe(requestsPerPattern - config.allowedPerInterval);
    });
  }, 25000);

  test("TTL expiration test: rate limit key should expire and unblock requests", async () => {
    // Use a very short interval for faster testing
    const config: TRateLimitConfig = {
      interval: 3, // 3 seconds
      allowedPerInterval: 2,
      namespace: "test:ttl",
    };

    const identifier = "ttl-test-user";

    // Clear any existing keys first
    const existingKeys = await redis!.keys(`fb:rate_limit:${config.namespace}:*`);
    if (existingKeys.length > 0) {
      await redis!.del(...existingKeys);
    }

    console.log("Phase 1: Hitting rate limit...");

    // Phase 1: Make requests until rate limit is hit
    const phase1Promises = Array.from({ length: 5 }, () => checkRateLimit(config, identifier));

    const phase1Results = await Promise.all(phase1Promises);
    const phase1Allowed = phase1Results.filter((r) => r.ok && r.data.allowed).length;
    const phase1Denied = phase1Results.filter((r) => r.ok && !r.data.allowed).length;

    console.log(`Phase 1 results: ${phase1Allowed} allowed, ${phase1Denied} denied`);

    // Verify rate limit is working
    expect(phase1Allowed).toBe(config.allowedPerInterval);
    expect(phase1Denied).toBe(5 - config.allowedPerInterval);

    // Check that the key exists in Redis
    const now = Date.now();
    const windowStart = Math.floor(now / (config.interval * 1000)) * config.interval;
    const expectedKey = `fb:rate_limit:${config.namespace}:${identifier}:${windowStart}`;

    const keyExists = await redis!.exists(expectedKey);
    expect(keyExists).toBe(1);
    console.log(`Redis key exists: ${expectedKey}`);

    // Check the TTL
    const ttl = await redis!.ttl(expectedKey);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(config.interval);
    console.log(`Key TTL: ${ttl} seconds`);

    // Phase 2: Wait for TTL to expire
    console.log(`Phase 2: Waiting for TTL expiration (${config.interval + 1} seconds)...`);
    await new Promise((resolve) => setTimeout(resolve, (config.interval + 1) * 1000));

    // Verify key has been automatically deleted by Redis
    const keyExistsAfterTTL = await redis!.exists(expectedKey);
    expect(keyExistsAfterTTL).toBe(0);
    console.log("Key automatically deleted by Redis TTL ✅");

    // Phase 3: Make new requests after TTL expiration
    console.log("Phase 3: Making requests after TTL expiration...");

    const phase3Promises = Array.from({ length: 5 }, () => checkRateLimit(config, identifier));

    const phase3Results = await Promise.all(phase3Promises);
    const phase3Allowed = phase3Results.filter((r) => r.ok && r.data.allowed).length;
    const phase3Denied = phase3Results.filter((r) => r.ok && !r.data.allowed).length;

    console.log(`Phase 3 results: ${phase3Allowed} allowed, ${phase3Denied} denied`);

    // Should get fresh limits after TTL expiration
    expect(phase3Allowed).toBe(config.allowedPerInterval);
    expect(phase3Denied).toBe(5 - config.allowedPerInterval);

    // Verify new key was created for the new window
    const newNow = Date.now();
    const newWindowStart = Math.floor(newNow / (config.interval * 1000)) * config.interval;
    const newKey = `fb:rate_limit:${config.namespace}:${identifier}:${newWindowStart}`;

    const newKeyExists = await redis!.exists(newKey);
    expect(newKeyExists).toBe(1);
    console.log(`New Redis key created: ${newKey}`);

    // Phase 4: Test that we're blocked again within the new window
    console.log("Phase 4: Verifying rate limit is active in new window...");

    const phase4Promises = Array.from({ length: 3 }, () => checkRateLimit(config, identifier));

    const phase4Results = await Promise.all(phase4Promises);
    const phase4Allowed = phase4Results.filter((r) => r.ok && r.data.allowed).length;
    const phase4Denied = phase4Results.filter((r) => r.ok && !r.data.allowed).length;

    console.log(`Phase 4 results: ${phase4Allowed} allowed, ${phase4Denied} denied`);

    // Should be blocked since we already used up the limit in phase 3
    expect(phase4Allowed).toBe(0);
    expect(phase4Denied).toBe(3);

    console.log("✅ TTL expiration working correctly - rate limits properly reset after expiration");
  }, 20000);
});
