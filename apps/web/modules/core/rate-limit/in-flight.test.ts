import { beforeEach, describe, expect, test, vi } from "vitest";
import { cache } from "@/lib/cache";
import { acquireInFlightSlot, releaseInFlightSlot } from "./in-flight";

vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/cache", () => ({
  cache: {
    getRedisClient: vi.fn(),
    runRedisOperation: vi.fn((operation: (client: typeof redis) => Promise<unknown>) => operation(redis)),
  },
}));
const constants = vi.hoisted(() => ({ RATE_LIMITING_DISABLED: false }));
vi.mock("@/lib/constants", () => constants);

const config = { interval: 120, allowedPerInterval: 2, namespace: "api:v3:charts:in-flight" };
const redis = { evalSha: vi.fn(), zRem: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  constants.RATE_LIMITING_DISABLED = false;
  vi.mocked(cache.getRedisClient).mockResolvedValue(redis as never);
});

describe("acquireInFlightSlot", () => {
  test("takes a slot keyed to the principal, with the limit and the lease in milliseconds", async () => {
    redis.evalSha.mockResolvedValueOnce(1);

    const { allowed, slot } = await acquireInFlightSlot(config, "key_1");

    expect(allowed).toBe(true);
    expect(slot).toMatchObject({
      key: "fb:rate_limit:api:v3:charts:in-flight:key_1:in_flight",
      released: false,
    });
    const [, options] = redis.evalSha.mock.calls[0];
    expect(options).toEqual({
      keys: [slot?.key],
      arguments: ["2", "120000", slot?.member],
    });
  });

  test("refuses when Redis says every slot is taken", async () => {
    redis.evalSha.mockResolvedValueOnce(0);
    expect(await acquireInFlightSlot(config, "key_1")).toEqual({ allowed: false });
  });

  test("fails open, with nothing to give back, when limiting is off, Redis is missing, or it errors", async () => {
    constants.RATE_LIMITING_DISABLED = true;
    expect(await acquireInFlightSlot(config, "key_1")).toEqual({ allowed: true });
    constants.RATE_LIMITING_DISABLED = false;

    vi.mocked(cache.getRedisClient).mockResolvedValueOnce(null as never);
    expect(await acquireInFlightSlot(config, "key_1")).toEqual({ allowed: true });

    redis.evalSha.mockRejectedValueOnce(new Error("connection reset"));
    expect(await acquireInFlightSlot(config, "key_1")).toEqual({ allowed: true });
  });
});

describe("releaseInFlightSlot", () => {
  test("removes the slot's member once, and swallows a failure", async () => {
    const slot = { key: "k", member: "m", released: false };

    await releaseInFlightSlot(slot);
    await releaseInFlightSlot(slot);
    expect(redis.zRem).toHaveBeenCalledTimes(1);
    expect(redis.zRem).toHaveBeenCalledWith("k", "m");

    redis.zRem.mockRejectedValueOnce(new Error("connection reset"));
    await expect(releaseInFlightSlot({ key: "k", member: "n", released: false })).resolves.toBeUndefined();
  });
});
