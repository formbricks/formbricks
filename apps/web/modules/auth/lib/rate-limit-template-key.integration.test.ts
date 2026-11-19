import { createRateLimitKey } from "@better-auth/core/utils/ip";
import { randomUUID } from "node:crypto";
import { createClient } from "redis";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createRedisBytesWritten } from "@/integration/redis-bytes-written";
import { auth, getDeclaredAuthPaths } from "./auth";
import { UNMATCHED_AUTH_PATH_TEMPLATE, createAuthPathTemplateMatcher } from "./rate-limit-template-key";

/**
 * ENG-7399: Better Auth's limiter keyed each counter on the raw request path, so distinct junk paths and
 * distinct reset tokens were each a fresh counter: the per-IP limit never tripped, and every request parked
 * a key the size of its URL in Redis. Driven through the storage the real `auth` instance is configured
 * with, against the real endpoint registry and Redis. (The harness turns rate limiting off for the HTTP
 * route, so the storage is called directly, with keys built by Better Auth's own `createRateLimitKey`.)
 */

const redis = createRedisBytesWritten();
const inspector = createClient({ url: process.env.REDIS_URL });
/** The counters a client holds, by name: proves which template the real storage chose. */
const countersOf = async (ip: string) => (await inspector.keys(`${ip}|*`)).sort();
const storage = auth.options.rateLimit?.customStorage;
const declaredPaths = getDeclaredAuthPaths();

beforeAll(async () => {
  await Promise.all([redis.connect(), inspector.connect()]);
});

afterAll(async () => {
  await Promise.all([redis.quit(), inspector.quit()]);
});

describe("rate-limit counters keyed per endpoint template (ENG-7399)", () => {
  test("the auth instance counts with the template-keyed storage", () => {
    expect(storage).toBeDefined();
  });

  test("every endpoint Better Auth declares is counted under its own template", () => {
    // Guards a Better Auth upgrade that declares a path shape the matcher doesn't know (a wildcard, say):
    // such an endpoint would silently share the unmatched bucket.
    const templateOf = createAuthPathTemplateMatcher(declaredPaths);
    const declared = declaredPaths.filter((path): path is string => typeof path === "string");
    expect(declared.length).toBeGreaterThan(50);
    for (const path of declared) expect(templateOf(path), path).toBe(path);
    // And no two templates claim the same request: a concrete path of each parameterized one names only it.
    for (const path of declared.filter((template) => template.includes(":"))) {
      const concrete = path.replaceAll(/:[^/]+/g, "x");
      expect(templateOf(concrete), concrete).toBe(path);
    }
  });

  test("distinct junk paths from one client share one small counter, which then trips", async () => {
    // A fresh client id per run, so a counter left by an earlier run inside its window can't interfere.
    const ip = `junk-${randomUUID()}`;
    const rule = { window: 10, max: 3 };
    const { result, storedBytes } = await redis.measure(async () => {
      const outcomes = [];
      for (let i = 0; i < 5; i++) {
        outcomes.push(
          await storage.consume(createRateLimitKey(ip, `/${randomUUID()}-${"j".repeat(12_000)}`), rule)
        );
      }
      return outcomes;
    });

    expect(result.map((outcome) => outcome.allowed)).toEqual([true, true, true, false, false]);
    expect(await countersOf(ip)).toEqual([`${ip}|${UNMATCHED_AUTH_PATH_TEMPLATE}|10`]);
    // One counter (a few-digit value), however long and however many the paths were.
    expect(storedBytes).toBeLessThan(8);
  });

  test("distinct reset tokens from one client share the endpoint's counter", async () => {
    const ip = `token-${randomUUID()}`;
    const rule = { window: 60, max: 5 };
    const { result } = await redis.measure(async () => {
      const outcomes = [];
      for (let i = 0; i < 7; i++) {
        outcomes.push(
          await storage.consume(
            createRateLimitKey(ip, `/reset-password/${randomUUID()}${"t".repeat(8_000)}`),
            rule
          )
        );
      }
      return outcomes;
    });

    expect(result.filter((outcome) => outcome.allowed)).toHaveLength(5);
    // Named by the template the storage read from the real registry, not the unmatched bucket.
    expect(await countersOf(ip)).toEqual([`${ip}|/reset-password/:token|60`]);
    // A request Better Auth gives another rule counts apart, so it can't reset this counter's TTL.
    expect(
      // `max: 1`: had it shared the 60 s counter (already at 7), this would be refused.
      await storage.consume(createRateLimitKey(ip, "/reset-password/x"), { window: 10, max: 1 })
    ).toEqual({
      allowed: true,
      retryAfter: null,
    });
    expect(await countersOf(ip)).toEqual([
      `${ip}|/reset-password/:token|10`,
      `${ip}|/reset-password/:token|60`,
    ]);
    expect(createAuthPathTemplateMatcher(declaredPaths)("/reset-password/abc")).toBe(
      "/reset-password/:token"
    );
    expect(createAuthPathTemplateMatcher(declaredPaths)("/nope")).toBe(UNMATCHED_AUTH_PATH_TEMPLATE);
  });
});
