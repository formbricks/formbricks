import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { redisSecondaryStorage } from "./secondary-storage";

// Run only against the disposable loopback Redis started by verify-redis-tls.mjs.
const connections = vi.hoisted(() => [] as Array<{ isOpen: boolean; destroy: () => void }>);
vi.mock("@/lib/env", () => ({
  env: { REDIS_URL: process.env.REDIS_TLS_TEST_URL, REDIS_TLS_CA: process.env.REDIS_TLS_CA },
}));
vi.mock("redis", async (importOriginal) => {
  const redis = await importOriginal<typeof import("redis")>();
  return {
    ...redis,
    createClient: (...args: Parameters<typeof redis.createClient>) => {
      const client = redis.createClient(...args);
      connections.push(client);
      return client;
    },
  };
});

describe.skipIf(!process.env.REDIS_TLS_TEST_URL)("authentication storage over verified Redis TLS", () => {
  const key = `redis-tls-test:${randomUUID()}`;

  beforeAll(() => {
    expect(new URL(process.env.REDIS_TLS_TEST_URL!).hostname).toBe("127.0.0.1");
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).not.toBe("0");
  });

  afterAll(async () => {
    try {
      await redisSecondaryStorage.delete(key);
    } finally {
      for (const client of connections) if (client.isOpen) client.destroy();
    }
  });

  test("writes and reads authentication records", async () => {
    await redisSecondaryStorage.set(key, "session-record", 60);
    expect(await redisSecondaryStorage.get(key)).toBe("session-record");
  });

  test("consumes a single-use record exactly once", async () => {
    await redisSecondaryStorage.set(key, "one-time-record", 60);
    expect(await redisSecondaryStorage.getAndDelete(key)).toBe("one-time-record");
    expect(await redisSecondaryStorage.getAndDelete(key)).toBeNull();
  });

  test("increments authentication rate-limit counters", async () => {
    expect(await redisSecondaryStorage.increment(key, 60)).toBe(1);
    expect(await redisSecondaryStorage.increment(key, 60)).toBe(2);
  });
});
