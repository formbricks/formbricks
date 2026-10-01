import { randomUUID } from "node:crypto";
import { createClient } from "redis";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { sampleAuthFailure } from "./auth-failure-sampling";

const redis = createClient({ url: process.env.REDIS_URL ?? "redis://localhost:6379/15" });
vi.mock("@/lib/cache", () => ({ cache: { getRedisClient: () => redis } }));
beforeAll(async () => {
  await redis.connect();
});
afterAll(async () => {
  await redis.quit();
});

describe("credential-failure sampling against real Redis", () => {
  test("exactly three initial events, then the tenth; suppressed counts match actual attempts", async () => {
    const identifier = randomUUID();
    const now = Math.floor(Date.now() / 300000) * 300000 + 1000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const results = [];
    for (let attempt = 1; attempt <= 20; attempt++) results.push(await sampleAuthFailure(identifier));
    expect(
      results
        .filter(({ emit }) => emit)
        .map(({ attemptCount, suppressedCount }) => [attemptCount, suppressedCount])
    ).toEqual([
      [1, 0],
      [2, 0],
      [3, 0],
      [10, 6],
      [20, 9],
    ]);
    expect(results.map(({ attemptCount }) => attemptCount)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1)
    );
    vi.restoreAllMocks();
  });
  test("minute gap is measured since the last emitted event, including concurrent attempts", async () => {
    const identifier = randomUUID();
    const now = Math.floor(Date.now() / 300000) * 300000 + 1000;
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    await Promise.all(Array.from({ length: 3 }, () => sampleAuthFailure(identifier)));
    clock.mockReturnValue(now + 59000);
    expect((await sampleAuthFailure(identifier)).emit).toBe(false);
    clock.mockReturnValue(now + 60000);
    const burst = await Promise.all(Array.from({ length: 4 }, () => sampleAuthFailure(identifier)));
    expect(burst.filter(({ emit }) => emit)).toEqual([
      expect.objectContaining({ attemptCount: 5, suppressedCount: 1 }),
    ]);
    vi.restoreAllMocks();
  });
});
