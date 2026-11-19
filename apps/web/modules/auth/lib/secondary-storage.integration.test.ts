import { randomUUID } from "node:crypto";
import { createClient } from "redis";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { redisSecondaryStorage } from "./secondary-storage";

/**
 * `setMax`'s Lua script against a real Redis-compatible server (Valkey in the integration stack): what it
 * stores and how long it keeps it, for each value the key can already hold. The revocation mark
 * (`oauth-revocation-marker.ts`) depends on it never going down and never outliving its TTL.
 */

const inspector = createClient({ url: process.env.REDIS_URL });
const TTL_SECONDS = 600;

beforeAll(async () => {
  await inspector.connect();
});

afterAll(async () => {
  await inspector.quit();
});

const key = () => `test:set-max:${randomUUID()}`;

/** The key's value and its TTL in seconds, after `setMax(key, 2_000, TTL_SECONDS)`. */
const afterSetMax = async (stored: string | null, storedTtlSeconds?: number) => {
  const name = key();
  if (stored !== null) {
    await inspector.set(name, stored, storedTtlSeconds ? { EX: storedTtlSeconds } : undefined);
  }
  await redisSecondaryStorage.setMax(name, 2_000, TTL_SECONDS);
  const [value, ttl] = await Promise.all([inspector.get(name), inspector.ttl(name)]);
  await inspector.del(name);
  return { value, ttl };
};

describe("redisSecondaryStorage.setMax (real Redis)", () => {
  test.each([
    ["absent", null, "2000"],
    ["lower", "1999", "2000"],
    ["equal", "2000", "2000"],
    ["higher", "2001", "2001"],
    // Not a number: overwritten, so a corrupt mark becomes a real one rather than blocking every write.
    ["not a number", "not-a-time", "2000"],
  ])("with a stored value %s, keeps the larger number and sets the TTL", async (_case, stored, expected) => {
    const { value, ttl } = await afterSetMax(stored, 30);

    expect(value).toBe(expected);
    expect(ttl).toBeGreaterThan(TTL_SECONDS - 5);
    expect(ttl).toBeLessThanOrEqual(TTL_SECONDS);
  });

  // A key stored without a TTL still expires once the mark is written over it, kept or not.
  test("gives a key stored without a TTL one, whether it keeps the value or not", async () => {
    for (const stored of ["1000", "3000"]) {
      const { ttl } = await afterSetMax(stored);
      expect(ttl).toBeGreaterThan(TTL_SECONDS - 5);
    }
  });
});
