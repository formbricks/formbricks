import { beforeEach, describe, expect, test, vi } from "vitest";
import { cache } from "@/lib/cache";
import { claimSsoRecovery, markSsoRecoverySpent } from "./recovery-claim";

vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/cache", () => ({ cache: { getRedisClient: vi.fn() } }));

const mockCache = vi.mocked(cache);

/** A Redis double with the semantics the two scripts and SET rely on. */
const store = new Map<string, { value: string; ttlMs?: number }>();
const evalKeys: string[][] = [];
const redis = {
  set: vi.fn(async (key: string, value: string, options?: { PX?: number }) => {
    store.set(key, { value, ttlMs: options?.PX });
    return "OK";
  }),
  eval: vi.fn(async (script: string, { keys, arguments: args }: { keys: string[]; arguments: string[] }) => {
    evalKeys.push(keys);
    if (script.includes("EXISTS")) {
      const [spentKey, claimKey] = keys;
      if (store.has(spentKey)) return 0;
      if (store.has(claimKey)) return 2;
      store.set(claimKey, { value: args[0], ttlMs: Number(args[1]) });
      return 1;
    }
    const [claimKey] = keys;
    if (store.get(claimKey)?.value !== args[0]) return 0;
    store.delete(claimKey);
    return 1;
  }),
};

const claimed = (claim: Awaited<ReturnType<typeof claimSsoRecovery>>) => {
  if (claim.kind !== "claimed") throw new Error(`expected a claim, got ${claim.kind}`);
  return claim;
};

describe("SSO recovery claim (ENG-7395)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    evalKeys.length = 0;
    mockCache.getRedisClient.mockResolvedValue(redis as never);
  });

  test("one request holds a recovery at a time, and none once it is spent", async () => {
    const first = claimed(await claimSsoRecovery("recovery-1"));
    await expect(claimSsoRecovery("recovery-1")).resolves.toEqual({ kind: "held" });

    await first.release();
    claimed(await claimSsoRecovery("recovery-1")).release();

    await expect(markSsoRecoverySpent("recovery-1")).resolves.toBe(true);
    await expect(claimSsoRecovery("recovery-1")).resolves.toEqual({ kind: "spent" });
  });

  test("recoveries do not hold each other", async () => {
    claimed(await claimSsoRecovery("recovery-1"));
    claimed(await claimSsoRecovery("recovery-2"));
  });

  test("a claim that lapsed and was retaken is not freed by its first owner", async () => {
    const first = claimed(await claimSsoRecovery("recovery-1"));
    for (const key of [...store.keys()]) if (key.endsWith(":claim")) store.delete(key);
    claimed(await claimSsoRecovery("recovery-1"));

    await first.release();

    await expect(claimSsoRecovery("recovery-1")).resolves.toEqual({ kind: "held" });
  });

  test("puts the spent marker and the claim in one Redis Cluster hash slot", async () => {
    await claimSsoRecovery("recovery-1");

    const hashTags = evalKeys[0].map((key) => /\{([^}]+)\}/.exec(key)?.[1]);
    expect(hashTags).toEqual(["recovery-1", "recovery-1"]);
  });

  test("the claim expires on its own, and the spent marker outlives the intent", async () => {
    await claimSsoRecovery("recovery-1");
    await markSsoRecoverySpent("recovery-1");

    const ttlOf = (suffix: string) => [...store.entries()].find(([key]) => key.endsWith(suffix))?.[1].ttlMs;
    expect(ttlOf(":claim")).toBeGreaterThan(10_000);
    expect(ttlOf(":claim")).toBeLessThanOrEqual(5 * 60 * 1000);
    expect(ttlOf(":spent")).toBeGreaterThan(15 * 60 * 1000);
  });

  test("does not act when Redis cannot answer, and never throws", async () => {
    mockCache.getRedisClient.mockResolvedValue(null);
    await expect(claimSsoRecovery("recovery-1")).resolves.toEqual({ kind: "unavailable" });
    await expect(markSsoRecoverySpent("recovery-1")).resolves.toBe(false);

    mockCache.getRedisClient.mockRejectedValue(new Error("down"));
    await expect(claimSsoRecovery("recovery-1")).resolves.toEqual({ kind: "unavailable" });
    await expect(markSsoRecoverySpent("recovery-1")).resolves.toBe(false);
  });
});
