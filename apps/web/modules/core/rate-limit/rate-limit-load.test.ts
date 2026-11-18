import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, test, vi } from "vitest";
import { cache } from "@/lib/cache";
import { applyRateLimit } from "./helpers";
import { checkRateLimit, reserveRateLimit, settleRateLimit } from "./rate-limit";
import { TRateLimitConfig } from "./types/rate-limit";

async function checkRedisAvailability() {
  try {
    const redis = await cache.getRedisClient();
    if (redis === null) {
      console.log("Redis client is null - Redis not available");
      return false;
    }

    await redis.ping();
    return true;
  } catch (error) {
    console.error("Error checking Redis availability:", error);
    return false;
  }
}

// Decided at collection time, so a missing Redis reports the suite as skipped rather than passed.
const isRedisAvailable = await checkRedisAvailability();

/**
 * Rate Limiter Load Tests - Race Condition Detection
 *
 * This suite verifies that the Redis Lua script admits exactly `allowedPerInterval` requests per fixed
 * window under high concurrency, and that windows roll over and expire correctly.
 *
 * Prerequisites: a reachable Redis/Valkey in REDIS_URL. Without one the suite is reported as skipped.
 *
 * Running the tests:
 * Local development: cd apps/web && npx vitest run modules/core/rate-limit/rate-limit-load.test.ts
 * CI Environment: Tests run automatically in E2E workflow with Redis/Valkey service
 *
 * Determinism (ENG-2756): the limiter derives its window key from `Date.now()` on every call, so a real
 * window boundary falling mid-burst split a burst across two keys and broke the exact counts. Each test
 * therefore freezes `Date` (only `Date`: Redis I/O and timers stay real) 100 ms after the next real
 * window boundary, and moves to the next window by advancing the frozen clock instead of sleeping.
 * Being 100 ms into the window makes the script's first-write EXPIRE the full interval. Windows are a
 * minute or longer, so no key can expire in real time mid-test even if the worker pauses: Valkey keeps
 * its own clock. Every identifier carries a random UUID, so no counter survives from another run or
 * leaks between tests.
 *
 * Failure Indicators:
 * - More requests allowed than the limit: race condition in the increment
 * - Fewer requests allowed than the limit: failed operations or lock contention
 * - Identifier interference: key collision or namespace issues
 * - Window rollover failures: TTL or window calculation errors
 */

// Every config passed to `expectExactlyAdmitted` fails closed: a Redis error then comes back as `err`,
// which the helper rejects, instead of the fail-open `allowed: true` it would count as an admission.
const TEST_CONFIGS = {
  // Very restrictive for race condition testing
  strict: {
    interval: 60,
    allowedPerInterval: 3,
    namespace: "test:strict",
    failClosed: true,
  } as TRateLimitConfig,

  // Medium restrictive
  medium: {
    interval: 60,
    allowedPerInterval: 10,
    namespace: "test:medium",
    failClosed: true,
  } as TRateLimitConfig,

  // High throughput
  high: {
    interval: 60,
    allowedPerInterval: 50,
    namespace: "test:high",
    failClosed: true,
  } as TRateLimitConfig,
} as const;

type TCheckResult = Awaited<ReturnType<typeof checkRateLimit>>;

const createdIdentifiers = new Set<string>();

/** A per-run identifier, so counters from earlier runs or other tests can never be read. */
const uniqueIdentifier = (prefix: string): string => {
  const identifier = `${prefix}-${randomUUID()}`;
  createdIdentifiers.add(identifier);
  return identifier;
};

/**
 * Freeze `Date` 100 ms after the next real boundary of a window of `intervalSeconds`, and return the
 * frozen time in milliseconds.
 */
const freezeClockAtWindowStart = (intervalSeconds: number): number => {
  const intervalMs = intervalSeconds * 1000;
  const frozenNow = (Math.floor(Date.now() / intervalMs) + 1) * intervalMs + 100;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(frozenNow);
  return frozenNow;
};

/** The fixed-window key the limiter must charge at `now`, rebuilt independently of `rate-limit.ts`. */
const windowKey = (config: TRateLimitConfig, identifier: string, now: number): string => {
  const windowStart = Math.floor(now / (config.interval * 1000)) * config.interval;
  return `fb:rate_limit:${config.namespace}:${identifier}:${windowStart}`;
};

type TRedisClient = NonNullable<Awaited<ReturnType<typeof cache.getRedisClient>>>;

/** Now on Valkey's clock, in milliseconds: the clock its key expiries use (`Date` is faked here). */
const redisNowMs = async (redis: TRedisClient): Promise<number> => {
  const [seconds, microseconds] = await redis.time();
  return Number(seconds) * 1000 + Math.floor(Number(microseconds) / 1000);
};

/**
 * A key written between `before` and `after` (Valkey's clock) must expire exactly one interval after
 * its write: not sooner, or the window's quota resets early, and not later. `EXPIRE` stores the write's
 * own millisecond time plus the whole seconds, so no rounding slack is needed beyond the bracket.
 */
const expectFullIntervalExpiry = (
  expiresAt: number,
  config: TRateLimitConfig,
  before: number,
  after: number
) => {
  const intervalMs = config.interval * 1000;
  expect(expiresAt).toBeGreaterThanOrEqual(before + intervalMs);
  expect(expiresAt).toBeLessThanOrEqual(after + intervalMs);
};

/**
 * Every result must be an answer from Redis, and exactly `limit` of them may be admitted. Only holds for
 * a `failClosed` config: a fail-open one turns a Redis error into an admission.
 */
const expectExactlyAdmitted = (results: TCheckResult[], limit: number) => {
  const allowed = results.filter((r) => r.ok && r.data.allowed).length;
  const denied = results.filter((r) => r.ok && !r.data.allowed).length;

  expect(allowed + denied).toBe(results.length);
  expect(allowed).toBe(limit);
  expect(denied).toBe(results.length - limit);
};

describe.skipIf(!isRedisAvailable)("Rate Limiter Load Tests - Race Conditions", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    const redis = await cache.getRedisClient();
    if (!redis) return;

    // One SCAN pass (never KEYS, which blocks the server), deleting only this run's identifiers.
    const ours = [...createdIdentifiers].map((identifier) => `:${identifier}:`);
    for await (const keys of redis.scanIterator({ MATCH: "fb:rate_limit:test:*", COUNT: 1000 })) {
      const mine = keys.filter((key) => ours.some((part) => key.includes(part)));
      if (mine.length > 0) await redis.del(mine);
    }
  });

  test("Weighted requests preserve the first-write TTL and reject without consuming quota", async () => {
    const config: TRateLimitConfig = {
      interval: 3600,
      allowedPerInterval: 5,
      namespace: "test:weighted",
    };
    const now = freezeClockAtWindowStart(config.interval);
    const identifier = uniqueIdentifier("weighted-test");
    const key = windowKey(config, identifier, now);
    const redis = await cache.getRedisClient();
    if (!redis) throw new Error("Expected a Redis client");

    const beforeFirst = await redisNowMs(redis);
    const firstResult = await checkRateLimit(config, identifier, 3);
    const afterFirst = await redisNowMs(redis);
    expect(firstResult).toEqual({ ok: true, data: { allowed: true, retryAfter: undefined } });
    expect(await redis.get(key)).toBe("3");

    const firstExpiry = await redis.pExpireTime(key);
    expectFullIntervalExpiry(firstExpiry, config, beforeFirst, afterFirst);

    // Wait until Valkey's clock has moved past the first write, so an EXPIRE reset by the second
    // admission would store a later expiry and fail the equality below.
    await expect.poll(() => redisNowMs(redis)).toBeGreaterThan(afterFirst);

    const secondResult = await checkRateLimit(config, identifier, 2);
    expect(secondResult).toEqual({ ok: true, data: { allowed: true, retryAfter: undefined } });
    expect(await redis.get(key)).toBe("5");
    expect(await redis.pExpireTime(key)).toBe(firstExpiry);

    const rejectedResult = await checkRateLimit(config, identifier, 1);
    expect(rejectedResult.ok).toBe(true);
    if (rejectedResult.ok) {
      expect(rejectedResult.data.allowed).toBe(false);
      expect(rejectedResult.data.retryAfter).toBeGreaterThan(0);
    }
    expect(await redis.get(key)).toBe("5");
  });

  test("Reservations release failed units without extending the fixed window", async () => {
    const config: TRateLimitConfig = {
      interval: 3600,
      allowedPerInterval: 5,
      namespace: "test:reservation",
    };
    const now = freezeClockAtWindowStart(config.interval);
    const identifier = uniqueIdentifier("reservation-test");
    const redis = await cache.getRedisClient();
    if (!redis) throw new Error("Expected a Redis client");

    const result = await reserveRateLimit(config, identifier, 5);
    expect(result.ok).toBe(true);
    if (!result.ok || !result.data.reservation) {
      throw new Error("Expected a rate-limit reservation");
    }
    expect(result.data.reservation.key).toBe(windowKey(config, identifier, now));

    const initialTtl = await redis.ttl(result.data.reservation.key);
    await settleRateLimit(result.data.reservation, 2);

    expect(await redis.get(result.data.reservation.key)).toBe("2");
    expect(await redis.ttl(result.data.reservation.key)).toBeLessThanOrEqual(initialTtl);
  });

  test("Settlement cannot decrement a newer fixed window", async () => {
    const config: TRateLimitConfig = {
      interval: 60,
      allowedPerInterval: 5,
      namespace: "test:reservation-window",
    };
    const now = freezeClockAtWindowStart(config.interval);
    const identifier = uniqueIdentifier("reservation-window-test");
    const redis = await cache.getRedisClient();
    if (!redis) throw new Error("Expected a Redis client");

    const firstResult = await reserveRateLimit(config, identifier, 2);
    expect(firstResult.ok).toBe(true);
    if (!firstResult.ok || !firstResult.data.reservation) {
      throw new Error("Expected the first rate-limit reservation");
    }
    expect(firstResult.data.reservation.key).toBe(windowKey(config, identifier, now));

    const nextWindow = now + config.interval * 1000;
    vi.setSystemTime(nextWindow);

    const secondResult = await reserveRateLimit(config, identifier, 1);
    expect(secondResult.ok).toBe(true);
    if (!secondResult.ok || !secondResult.data.reservation) {
      throw new Error("Expected the second rate-limit reservation");
    }
    expect(secondResult.data.reservation.key).toBe(windowKey(config, identifier, nextWindow));

    expect(await redis.get(firstResult.data.reservation.key)).toBe("2");
    await settleRateLimit(firstResult.data.reservation, 0);

    // The release lands on the old window's key (fully released, so deleted), never on the new one.
    expect(await redis.get(firstResult.data.reservation.key)).toBeNull();
    expect(await redis.get(secondResult.data.reservation.key)).toBe("1");
  });

  test("Race condition test: concurrent requests to same identifier", async () => {
    const config = TEST_CONFIGS.strict;
    freezeClockAtWindowStart(config.interval);
    const identifier = uniqueIdentifier("race-test-same-id");
    const concurrentRequests = 20; // More than allowed (3)

    const results = await Promise.all(
      Array.from({ length: concurrentRequests }, () => checkRateLimit(config, identifier))
    );

    expectExactlyAdmitted(results, config.allowedPerInterval);
  }, 15000);

  test("Race condition test: multiple waves of concurrent requests", async () => {
    const config = TEST_CONFIGS.medium;
    freezeClockAtWindowStart(config.interval);
    const identifier = uniqueIdentifier("race-test-waves");
    const wavesCount = 3;
    const requestsPerWave = 15; // More than allowed (10)

    const allResults: TCheckResult[] = [];

    // The clock is frozen, so every wave lands in the same window.
    for (let wave = 0; wave < wavesCount; wave++) {
      const waveResults = await Promise.all(
        Array.from({ length: requestsPerWave }, () => checkRateLimit(config, identifier))
      );
      allResults.push(...waveResults);
    }

    // Should still only allow the configured limit across all waves
    expectExactlyAdmitted(allResults, config.allowedPerInterval);
  }, 20000);

  test("Race condition test: different identifiers should not interfere", async () => {
    const config = TEST_CONFIGS.strict;
    freezeClockAtWindowStart(config.interval);
    const identifiersCount = 5;
    const requestsPerIdentifier = 10;

    const identifiers = Array.from({ length: identifiersCount }, (_, i) =>
      uniqueIdentifier(`race-test-different-${i}`)
    );
    const results = await Promise.all(
      identifiers.flatMap((identifier) =>
        Array.from({ length: requestsPerIdentifier }, () =>
          checkRateLimit(config, identifier).then((result) => ({ identifier, result }))
        )
      )
    );

    // Each identifier should have exactly the allowed limit
    for (const identifier of identifiers) {
      const identifierResults = results.filter((r) => r.identifier === identifier).map((r) => r.result);
      expect(identifierResults).toHaveLength(requestsPerIdentifier);
      expectExactlyAdmitted(identifierResults, config.allowedPerInterval);
    }
  }, 20000);

  test("Window boundary test: the next window starts with a fresh limit", async () => {
    const config = {
      interval: 60,
      allowedPerInterval: 5,
      namespace: "test:boundary",
      failClosed: true,
    } as TRateLimitConfig;
    const now = freezeClockAtWindowStart(config.interval);
    const identifier = uniqueIdentifier("boundary-test");
    const redis = await cache.getRedisClient();
    if (!redis) throw new Error("Expected a Redis client");

    const firstResults = await Promise.all(
      Array.from({ length: 8 }, () => checkRateLimit(config, identifier))
    );
    expectExactlyAdmitted(firstResults, config.allowedPerInterval);

    const nextWindow = now + config.interval * 1000;
    vi.setSystemTime(nextWindow);

    // Second batch should get fresh limits
    const secondResults = await Promise.all(
      Array.from({ length: 8 }, () => checkRateLimit(config, identifier))
    );
    expectExactlyAdmitted(secondResults, config.allowedPerInterval);
    expect(await redis.get(windowKey(config, identifier, nextWindow))).toBe(
      String(config.allowedPerInterval)
    );
  }, 15000);

  test("High throughput stress test", async () => {
    const config = TEST_CONFIGS.high;
    freezeClockAtWindowStart(config.interval);
    const totalRequests = 200;
    const identifier = uniqueIdentifier("stress-test");

    const results = await Promise.all(
      Array.from({ length: totalRequests }, () => checkRateLimit(config, identifier))
    );

    // Should respect the rate limit even under high load
    expectExactlyAdmitted(results, config.allowedPerInterval);
  }, 30000);

  test("applyRateLimit function race condition test", async () => {
    const config = TEST_CONFIGS.strict;
    freezeClockAtWindowStart(config.interval);
    const identifier = uniqueIdentifier("apply-rate-limit-test");
    const concurrentRequests = 15;

    const results = await Promise.all(
      Array.from({ length: concurrentRequests }, async () => {
        try {
          await applyRateLimit(config, identifier);
          return { success: true, error: null };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      })
    );

    const successes = results.filter((r) => r.success).length;
    const failures = results.filter((r) => !r.success).length;

    // Should allow exactly the configured limit
    expect(successes).toBe(config.allowedPerInterval);
    expect(failures).toBe(concurrentRequests - config.allowedPerInterval);

    // All failures should be "Maximum number of requests reached. Please try again later."
    const rateLimitErrors = results.filter(
      (r) => r.error === "Maximum number of requests reached. Please try again later."
    ).length;
    expect(rateLimitErrors).toBe(failures);
  }, 15000);

  test("Mixed identifier patterns under load", async () => {
    const config = TEST_CONFIGS.medium;
    freezeClockAtWindowStart(config.interval);
    const patterns = ["user-123", "ip-192.168.1.1", "api-key-abc", "session-xyz"].map(uniqueIdentifier);
    const requestsPerPattern = 15;

    const allPromises: Promise<{ pattern: string; result: TCheckResult }>[] = [];
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

    for (const pattern of patterns) {
      const patternResults = results.filter((r) => r.pattern === pattern).map((r) => r.result);
      expect(patternResults).toHaveLength(requestsPerPattern);
      expectExactlyAdmitted(patternResults, config.allowedPerInterval);
    }
  }, 25000);

  test("TTL test: a window's key carries an expiry and the next window starts fresh", async () => {
    const config: TRateLimitConfig = {
      interval: 60,
      allowedPerInterval: 2,
      namespace: "test:ttl",
      failClosed: true,
    };
    const now = freezeClockAtWindowStart(config.interval);
    const identifier = uniqueIdentifier("ttl-test-user");
    const redis = await cache.getRedisClient();
    if (!redis) throw new Error("Expected a Redis client");

    // Phase 1: hit the limit in the first window, bracketed by Valkey's own clock
    const beforePhase1 = await redisNowMs(redis);
    const phase1Results = await Promise.all(
      Array.from({ length: 5 }, () => checkRateLimit(config, identifier))
    );
    const afterPhase1 = await redisNowMs(redis);
    expectExactlyAdmitted(phase1Results, config.allowedPerInterval);

    // The first write, 100 ms into the window, set an expiry of the full interval: not more, and not
    // less either, or the window's quota would reset early. Checked as an absolute expiry against the
    // write's time on Valkey's clock, so a worker stall before the read can't fail a correct limiter.
    // Deleting the key when it runs out is Valkey's job; the limiter's job is to set it.
    const firstKey = windowKey(config, identifier, now);
    expect(await redis.get(firstKey)).toBe(String(config.allowedPerInterval));
    expectFullIntervalExpiry(await redis.pExpireTime(firstKey), config, beforePhase1, afterPhase1);

    // Phase 2: move into the next window
    const nextWindow = now + config.interval * 1000;
    vi.setSystemTime(nextWindow);

    // Phase 3: fresh limits in the new window, on a new key with its own expiry
    const beforePhase3 = await redisNowMs(redis);
    const phase3Results = await Promise.all(
      Array.from({ length: 5 }, () => checkRateLimit(config, identifier))
    );
    const afterPhase3 = await redisNowMs(redis);
    expectExactlyAdmitted(phase3Results, config.allowedPerInterval);

    const newKey = windowKey(config, identifier, nextWindow);
    expect(newKey).not.toBe(firstKey);
    expect(await redis.get(newKey)).toBe(String(config.allowedPerInterval));
    expectFullIntervalExpiry(await redis.pExpireTime(newKey), config, beforePhase3, afterPhase3);

    // Phase 4: the new window's limit is already used up
    const phase4Results = await Promise.all(
      Array.from({ length: 3 }, () => checkRateLimit(config, identifier))
    );
    expectExactlyAdmitted(phase4Results, 0);
  }, 20000);
});
