import { beforeEach, describe, expect, test, vi } from "vitest";
import { claimSurveyImportIdempotencyKey } from "./idempotency";

// A Redis that stops answering cannot be staged against the real one without tripping the shared
// circuit breaker for every other test, so the cache service's deadline is played here.
const mocks = vi.hoisted(() => {
  const client = {
    set: vi.fn(async () => "OK"),
    get: vi.fn(async () => null),
    eval: vi.fn(async () => 1),
  };
  // What `getRedisClient` hands out: only a readiness check here, so no command may reach it.
  const raw = { set: vi.fn(), get: vi.fn(), eval: vi.fn() };
  return {
    client,
    raw,
    getRedisClient: vi.fn(async () => raw),
    runRedisOperation: vi.fn(async (operation: (redis: typeof client) => Promise<unknown>) =>
      operation(client)
    ),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/cache", () => ({
  cache: { getRedisClient: mocks.getRedisClient, runRedisOperation: mocks.runRedisOperation },
}));

const claim = () =>
  claimSurveyImportIdempotencyKey({ userId: "user_1", idempotencyKey: "key_1", fingerprint: "the request" });

describe("claimSurveyImportIdempotencyKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sends every command under the cache service's deadline, never on the raw client", async () => {
    const claimed = await claim();
    if (claimed.kind !== "claimed") throw new Error(`expected a claim, got ${claimed.kind}`);
    await claimed.complete("survey_1");
    await claimed.release();

    // claim, complete, release: each one command, each through the deadline.
    expect(mocks.runRedisOperation).toHaveBeenCalledTimes(3);
    expect([mocks.raw.set, mocks.raw.get, mocks.raw.eval].flatMap((command) => command.mock.calls)).toEqual(
      []
    );
  });

  test("creates without the guarantee when Redis misses the deadline on the claim", async () => {
    mocks.runRedisOperation.mockRejectedValueOnce(new Error("Redis operation timed out"));

    expect(await claim()).toEqual({ kind: "unavailable" });
  });

  test("gives back a claim that lands after the deadline, once it lands", async () => {
    let landClaim: (reply: string | null) => void = () => {};
    mocks.client.set.mockImplementationOnce(
      () => new Promise<string | null>((resolve) => (landClaim = resolve)) as never
    );
    // The deadline gives up on the SET it started; the SET itself stays pending.
    mocks.runRedisOperation.mockImplementationOnce(async (operation) => {
      void operation(mocks.client);
      throw new Error("Redis operation timed out");
    });

    expect(await claim()).toEqual({ kind: "unavailable" });
    expect(mocks.client.eval).not.toHaveBeenCalled();

    landClaim("OK");
    await vi.waitFor(() => expect(mocks.client.eval).toHaveBeenCalledTimes(1));
    const [script, { keys, arguments: args }] = mocks.client.eval.mock.calls[0] as unknown as [
      string,
      { keys: string[]; arguments: string[] },
    ];
    expect(script).toContain("DEL");
    expect(keys).toHaveLength(1);
    expect(JSON.parse(args[0])).toMatchObject({ state: "in_flight", fingerprint: "the request" });
  });

  test("gives nothing back when a claim that missed the deadline never lands", async () => {
    let landClaim: (reply: string | null) => void = () => {};
    mocks.client.set.mockImplementationOnce(
      () => new Promise<string | null>((resolve) => (landClaim = resolve)) as never
    );
    mocks.runRedisOperation.mockImplementationOnce(async (operation) => {
      void operation(mocks.client);
      throw new Error("Redis operation timed out");
    });

    expect(await claim()).toEqual({ kind: "unavailable" });
    landClaim(null);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.runRedisOperation).toHaveBeenCalledTimes(1);
    expect(mocks.client.eval).not.toHaveBeenCalled();
  });

  test("creates without the guarantee when Redis misses the deadline on the read after a lost claim", async () => {
    mocks.client.set.mockResolvedValueOnce(null as never);
    mocks.runRedisOperation
      .mockImplementationOnce(async (operation) => operation(mocks.client))
      .mockRejectedValueOnce(new Error("Redis operation timed out"));

    expect(await claim()).toEqual({ kind: "unavailable" });
  });

  test("lets a missed deadline on complete or release reach the caller, which logs it", async () => {
    const claimed = await claim();
    if (claimed.kind !== "claimed") throw new Error(`expected a claim, got ${claimed.kind}`);
    mocks.runRedisOperation.mockRejectedValue(new Error("Redis operation timed out"));

    await expect(claimed.complete("survey_1")).rejects.toThrow("timed out");
    await expect(claimed.release()).rejects.toThrow("timed out");
  });
});
