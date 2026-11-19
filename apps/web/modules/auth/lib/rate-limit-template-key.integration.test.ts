import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createRedisBytesWritten } from "@/integration/redis-bytes-written";
import { auth } from "./auth";
import { UNMATCHED_AUTH_PATH_TEMPLATE, createAuthPathTemplateMatcher } from "./rate-limit-template-key";

/**
 * ENG-7399: Better Auth's limiter keyed each counter on the raw request path, so distinct junk paths and
 * distinct reset tokens were each a fresh counter: the per-IP limit never tripped, and every request parked
 * a key the size of its URL in Redis. Driven through the storage the real `auth` instance is configured
 * with, against the real endpoint registry and Redis. (The harness turns rate limiting off for the HTTP
 * route, so the storage is called directly, with the key Better Auth would build: `${ip}|${path}`.)
 */

const redis = createRedisBytesWritten();
const storage = auth.options.rateLimit?.customStorage;
const declaredPaths = Object.values(auth.api).map((endpoint) => endpoint?.path);

beforeAll(async () => {
  await redis.connect();
});

afterAll(async () => {
  await redis.quit();
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
  });

  test("distinct junk paths from one client share one small counter, which then trips", async () => {
    // A fresh client id per run, so a counter left by an earlier run inside its window can't interfere.
    const ip = `junk-${randomUUID()}`;
    const rule = { window: 10, max: 3 };
    const { result, storedBytes } = await redis.measure(async () => {
      const outcomes = [];
      for (let i = 0; i < 5; i++) {
        outcomes.push(await storage.consume(`${ip}|/${randomUUID()}-${"j".repeat(12_000)}`, rule));
      }
      return outcomes;
    });

    expect(result.map((outcome) => outcome.allowed)).toEqual([true, true, true, false, false]);
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
          await storage.consume(`${ip}|/reset-password/${randomUUID()}${"t".repeat(8_000)}`, rule)
        );
      }
      return outcomes;
    });

    expect(result.filter((outcome) => outcome.allowed)).toHaveLength(5);
    expect(createAuthPathTemplateMatcher(declaredPaths)("/reset-password/abc")).toBe(
      "/reset-password/:token"
    );
    expect(createAuthPathTemplateMatcher(declaredPaths)("/nope")).toBe(UNMATCHED_AUTH_PATH_TEMPLATE);
  });
});
