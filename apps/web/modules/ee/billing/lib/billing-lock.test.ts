import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { acquireOrganizationBillingLock, withOrganizationBillingLock } from "./billing-lock";

const mocks = vi.hoisted(() => ({
  tryLock: vi.fn(),
  runRedisOperation: vi.fn(),
  redisEval: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/cache", () => ({
  cache: { tryLock: mocks.tryLock, runRedisOperation: mocks.runRedisOperation },
}));
vi.mock("@formbricks/logger", () => ({ logger: { warn: mocks.warn } }));

const LOCK_KEY = "fb:org:org_1:billing-sync-lock";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tryLock.mockResolvedValue({ ok: true, data: true });
  mocks.redisEval.mockResolvedValue(1);
  mocks.runRedisOperation.mockImplementation(async (operation: (redis: unknown) => unknown) =>
    operation({ eval: mocks.redisEval })
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("acquireOrganizationBillingLock", () => {
  test("takes the organization's billing-sync lock with a token of its own", async () => {
    const lock = await acquireOrganizationBillingLock("org_1", { ttlMs: 30_000 });

    expect(lock.status).toBe("acquired");
    expect(mocks.tryLock).toHaveBeenCalledWith(LOCK_KEY, expect.any(String), 30_000);
  });

  test("gives the lock back only while it still holds its own token", async () => {
    const lock = await acquireOrganizationBillingLock("org_1", { ttlMs: 30_000 });
    if (lock.status !== "acquired") throw new Error("expected the lock");
    const token = mocks.tryLock.mock.calls[0][1];

    await lock.release();

    expect(mocks.redisEval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('GET', KEYS[1]) == ARGV[1]"),
      {
        keys: [LOCK_KEY],
        arguments: [token],
      }
    );
  });

  test("answers busy at once without a wait", async () => {
    mocks.tryLock.mockResolvedValue({ ok: true, data: false });

    expect(await acquireOrganizationBillingLock("org_1", { ttlMs: 30_000 })).toEqual({ status: "busy" });
    expect(mocks.tryLock).toHaveBeenCalledTimes(1);
  });

  test("retries until the holder lets go within the wait", async () => {
    vi.useFakeTimers();
    mocks.tryLock
      .mockResolvedValueOnce({ ok: true, data: false })
      .mockResolvedValueOnce({ ok: true, data: false })
      .mockResolvedValue({ ok: true, data: true });

    const pending = acquireOrganizationBillingLock("org_1", { ttlMs: 30_000, waitMs: 10_000 });
    await vi.advanceTimersByTimeAsync(500);

    expect((await pending).status).toBe("acquired");
    expect(mocks.tryLock).toHaveBeenCalledTimes(3);
  });

  test("answers busy once the wait is over", async () => {
    vi.useFakeTimers();
    mocks.tryLock.mockResolvedValue({ ok: true, data: false });

    const pending = acquireOrganizationBillingLock("org_1", { ttlMs: 30_000, waitMs: 1_000 });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(await pending).toEqual({ status: "busy" });
  });

  test("answers unavailable when Redis does not", async () => {
    mocks.tryLock.mockResolvedValue({ ok: false, error: { code: "RedisConnectionError" } });

    expect(await acquireOrganizationBillingLock("org_1", { ttlMs: 30_000, waitMs: 10_000 })).toEqual({
      status: "unavailable",
    });
  });

  test("leaves a lock it can't give back to its TTL", async () => {
    mocks.runRedisOperation.mockRejectedValue(new Error("redis down"));
    const lock = await acquireOrganizationBillingLock("org_1", { ttlMs: 30_000 });
    if (lock.status !== "acquired") throw new Error("expected the lock");

    await expect(lock.release()).resolves.toBeUndefined();
    expect(mocks.warn).toHaveBeenCalled();
  });
});

describe("withOrganizationBillingLock", () => {
  test("runs the work holding the lock, then gives it back", async () => {
    const work = vi.fn(async () => {
      expect(mocks.redisEval).not.toHaveBeenCalled();
      return "done";
    });

    expect(await withOrganizationBillingLock("org_1", work, { ttlMs: 120_000 })).toEqual({
      ran: true,
      value: "done",
    });
    expect(mocks.redisEval).toHaveBeenCalledTimes(1);
  });

  test("gives the lock back when the work fails", async () => {
    await expect(
      withOrganizationBillingLock("org_1", () => Promise.reject(new Error("stripe down")), { ttlMs: 120_000 })
    ).rejects.toThrow("stripe down");
    expect(mocks.redisEval).toHaveBeenCalledTimes(1);
  });

  test("does not run the work while another holder keeps the lock", async () => {
    mocks.tryLock.mockResolvedValue({ ok: true, data: false });
    const work = vi.fn();

    expect(await withOrganizationBillingLock("org_1", work, { ttlMs: 120_000 })).toEqual({ ran: false });
    expect(work).not.toHaveBeenCalled();
  });

  test("runs the work unlocked when Redis is unavailable", async () => {
    mocks.tryLock.mockResolvedValue({ ok: false, error: { code: "RedisConnectionError" } });

    expect(await withOrganizationBillingLock("org_1", async () => 1, { ttlMs: 120_000 })).toEqual({
      ran: true,
      value: 1,
    });
    expect(mocks.warn).toHaveBeenCalledWith(
      { organizationId: "org_1" },
      "Organization billing lock unavailable; running without it"
    );
    expect(mocks.redisEval).not.toHaveBeenCalled();
  });
});
