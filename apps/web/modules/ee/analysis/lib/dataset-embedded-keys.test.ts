import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import {
  EMBEDDED_DATA_KEY_DIMENSION,
  EMBEDDED_KEYS_MATERIAL_SHIFT,
  EMBEDDED_KEYS_STALE_MS,
  FAILED_SCAN_RETRY_MS,
  RARE_EMBEDDED_KEY_CLASSES,
  RareEmbeddedKeysConflictError,
  getDatasetEmbeddedKeys,
  getEmbeddedKeysForQuery,
  getRareEmbeddedKeyClass,
  groupRareEmbeddedKeys,
  resolveEmbeddedMemberKeys,
  stabilizeTopEmbeddedKeys,
} from "./dataset-embedded-keys";
import {
  MAX_EMBEDDED_KEYS,
  MAX_RARE_EMBEDDED_KEYS,
  MAX_RARE_EMBEDDED_KEYS_BYTES,
  MAX_TOKEN_EMBEDDED_KEYS,
} from "./embedded-data-fields";
import { getEmbeddedMemberName } from "./embedded-member-name";

const { mockCache, mockExecute } = vi.hoisted(() => ({
  mockCache: { get: vi.fn(), set: vi.fn(), tryLock: vi.fn() },
  mockExecute: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/cache", () => ({ cache: mockCache }));
vi.mock("@/modules/ee/analysis/api/lib/cube-client", () => ({ executeTenantScopedQuery: mockExecute }));
// vitestSetup.ts fakes `crypto` for the license checks; a member name is a real hash.
vi.unmock("crypto");

const scope = {
  datasetId: "frd-1",
  workspaceId: "workspace-1",
  organizationId: "organization-1",
  actor: { type: "user" as const, id: "user-1" },
};
const rows = (...keys: unknown[]) =>
  keys.map((key) => ({ [EMBEDDED_DATA_KEY_DIMENSION]: key, "FeedbackRecords.count": 1 }));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("getDatasetEmbeddedKeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
    mockCache.set.mockResolvedValue({ ok: true, data: undefined });
    mockCache.tryLock.mockResolvedValue({ ok: true, data: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("discovers the keys of a dataset seen for the first time, on the plain model, and caches them", async () => {
    mockCache.get.mockResolvedValue({ ok: true, data: null });
    mockExecute.mockResolvedValue(rows("plan", "   ", "x".repeat(129), "Plan", null));

    await expect(getDatasetEmbeddedKeys(scope)).resolves.toEqual(["plan", "Plan"]);
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ dimensions: [EMBEDDED_DATA_KEY_DIMENSION], limit: 200 }),
        feedbackDirectoryId: "frd-1",
        source: "charts.embeddedKeyDiscovery",
        embeddedKeys: [],
      })
    );
    expect(mockCache.set).toHaveBeenCalledWith(
      "fb:analytics:frd-1:embedded-keys",
      { keys: ["plan", "Plan"], refreshedAt: Date.now() },
      7 * 24 * 60 * 60 * 1000
    );
  });

  test("has no keys for an empty dataset", async () => {
    mockCache.get.mockResolvedValue({ ok: true, data: null });
    mockExecute.mockResolvedValue([]);

    await expect(getDatasetEmbeddedKeys(scope)).resolves.toEqual([]);
  });

  test("answers a fresh cached list without scanning", async () => {
    mockCache.get.mockResolvedValue({ ok: true, data: { keys: ["plan"], refreshedAt: Date.now() - 1000 } });

    await expect(getDatasetEmbeddedKeys(scope)).resolves.toEqual(["plan"]);
    await flush();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  test("answers a stale list at once and refreshes it in the background, so a new key appears next time", async () => {
    mockCache.get.mockResolvedValue({
      ok: true,
      data: { keys: ["plan"], refreshedAt: Date.now() - EMBEDDED_KEYS_STALE_MS - 1 },
    });
    mockExecute.mockResolvedValue(rows("plan", "brand_new"));

    await expect(getDatasetEmbeddedKeys(scope)).resolves.toEqual(["plan"]);
    await flush();
    await flush();

    expect(mockCache.tryLock).toHaveBeenCalledWith("fb:analytics:frd-1:embedded-keys-lock", "1", 120_000);
    expect(mockCache.set).toHaveBeenCalledWith(
      "fb:analytics:frd-1:embedded-keys",
      { keys: ["plan", "brand_new"], refreshedAt: Date.now() },
      expect.any(Number)
    );
  });

  test("leaves the refresh to whoever holds the lock", async () => {
    mockCache.get.mockResolvedValue({
      ok: true,
      data: { keys: ["plan"], refreshedAt: Date.now() - EMBEDDED_KEYS_STALE_MS - 1 },
    });
    mockCache.tryLock.mockResolvedValue({ ok: true, data: false });

    await getDatasetEmbeddedKeys(scope);
    await flush();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  test("scans once for concurrent first requests", async () => {
    mockCache.get.mockResolvedValue({ ok: true, data: null });
    mockExecute.mockResolvedValue(rows("plan"));

    const results = await Promise.all([getDatasetEmbeddedKeys(scope), getDatasetEmbeddedKeys(scope)]);
    expect(results).toEqual([["plan"], ["plan"]]);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  test("offers no keys rather than failing when discovery or the cache fails", async () => {
    mockCache.get.mockResolvedValue({ ok: true, data: null });
    mockExecute.mockRejectedValue(new Error("cube down"));
    await expect(getDatasetEmbeddedKeys(scope)).resolves.toEqual([]);

    mockCache.get.mockResolvedValue({ ok: false, error: { code: "redis_connection_error" } });
    await expect(getDatasetEmbeddedKeys(scope)).resolves.toEqual([]);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  test("remembers a failed discovery briefly, so the next requests do not rescan", async () => {
    mockCache.get.mockResolvedValue({ ok: true, data: null });
    mockExecute.mockRejectedValue(new Error("cube down"));

    await getDatasetEmbeddedKeys(scope);
    expect(mockCache.set).toHaveBeenCalledWith(
      "fb:analytics:frd-1:embedded-keys",
      { keys: [], refreshedAt: Date.now() },
      FAILED_SCAN_RETRY_MS
    );
  });

  test("logs a failed discovery by error name and frames, never Cube's message", async () => {
    mockCache.get.mockResolvedValue({ ok: true, data: null });
    mockExecute.mockRejectedValue(new Error("relation feedback_records: secret column detail"));

    await getDatasetEmbeddedKeys(scope);

    const [fields] = vi.mocked(logger.warn).mock.calls[0] as [Record<string, unknown>];
    expect(fields).toMatchObject({ datasetId: "frd-1", errName: "Error" });
    expect(fields).not.toHaveProperty("err");
    expect(JSON.stringify(fields)).not.toContain("secret column detail");
  });
});

describe("stabilizeTopEmbeddedKeys", () => {
  const full = Array.from({ length: MAX_EMBEDDED_KEYS }, (_, index) => `key_${index}`);
  const newcomers = (count: number) => Array.from({ length: count }, (_, index) => `new_${index}`);
  // The newcomers outrank the last keys of the old set, which fall out of a fresh top 100.
  const rankedWith = (count: number) => [...newcomers(count), ...full];

  test("takes the fresh keys when there is no previous set", () => {
    expect(stabilizeTopEmbeddedKeys(undefined, ["a", "b"])).toEqual(["a", "b"]);
    expect(stabilizeTopEmbeddedKeys([], ["a", "b"])).toEqual(["a", "b"]);
    expect(stabilizeTopEmbeddedKeys([], [])).toEqual([]);
  });

  test("keeps a full set while fewer than the material shift of keys would enter it", () => {
    const shift = EMBEDDED_KEYS_MATERIAL_SHIFT - 1;
    expect(stabilizeTopEmbeddedKeys(full, rankedWith(shift))).toEqual(full);
  });

  test("takes the fresh set once the material shift of keys would enter it", () => {
    const ranked = rankedWith(EMBEDDED_KEYS_MATERIAL_SHIFT);
    expect(stabilizeTopEmbeddedKeys(full, ranked)).toEqual(ranked.slice(0, MAX_EMBEDDED_KEYS));
  });

  test("adds a new key to a set with room, without dropping or reordering the old ones", () => {
    expect(stabilizeTopEmbeddedKeys(["plan", "tier"], ["brand_new", "tier", "plan"])).toEqual([
      "plan",
      "tier",
      "brand_new",
    ]);
  });

  test("never keeps a key that can no longer compile", () => {
    expect(stabilizeTopEmbeddedKeys(["plan", "   "], ["plan"])).toEqual(["plan"]);
  });
});

describe("a stale key set refreshed with small rank shifts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
    mockCache.set.mockResolvedValue({ ok: true, data: undefined });
    mockCache.tryLock.mockResolvedValue({ ok: true, data: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("stores the same set again, so every compiled model stays valid", async () => {
    const full = Array.from({ length: MAX_EMBEDDED_KEYS }, (_, index) => `key_${index}`);
    mockCache.get.mockResolvedValue({
      ok: true,
      data: { keys: full, refreshedAt: Date.now() - EMBEDDED_KEYS_STALE_MS - 1 },
    });
    mockExecute.mockResolvedValue(rows("climber", ...full));

    await getDatasetEmbeddedKeys(scope);
    await flush();
    await flush();

    expect(mockCache.set).toHaveBeenCalledWith(
      "fb:analytics:frd-1:embedded-keys",
      { keys: full, refreshedAt: Date.now() },
      expect.any(Number)
    );
  });
});

describe("a saved query's keys outside the top keys", () => {
  const KEYS_KEY = "fb:analytics:frd-1:embedded-keys";
  const MEMBERS_KEY = "fb:analytics:frd-1:embedded-key-members";
  const topKeys = Array.from({ length: MAX_EMBEDDED_KEYS }, (_, index) => `top_${index}`);
  const member = getEmbeddedMemberName;
  let stored: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
    stored = { [KEYS_KEY]: { keys: topKeys, refreshedAt: Date.now() } };
    mockCache.get.mockImplementation(async (key: string) => ({ ok: true, data: stored[key] ?? null }));
    mockCache.set.mockImplementation(async (key: string, value: unknown) => {
      stored[key] = value;
      return { ok: true, data: undefined };
    });
    mockCache.tryLock.mockResolvedValue({ ok: true, data: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("resolves nothing and scans nothing for no members, or members among the top keys", async () => {
    await expect(resolveEmbeddedMemberKeys(scope, [])).resolves.toEqual(new Map());
    await expect(resolveEmbeddedMemberKeys(scope, [member("top_0"), member("top_99")])).resolves.toEqual(
      new Map([
        [member("top_0"), "top_0"],
        [member("top_99"), "top_99"],
      ])
    );
    expect(mockExecute).not.toHaveBeenCalled();
  });

  test("finds a key that fell out of the top 100 with one scan, and caches what it found", async () => {
    mockExecute.mockResolvedValue(rows(...topKeys, "rare plan", "   "));

    await expect(resolveEmbeddedMemberKeys(scope, [member("rare plan"), member("top_1")])).resolves.toEqual(
      new Map([
        [member("top_1"), "top_1"],
        [member("rare plan"), "rare plan"],
      ])
    );
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ dimensions: [EMBEDDED_DATA_KEY_DIMENSION], limit: 2000 }),
        embeddedKeys: [],
      })
    );
    expect(mockCache.set).toHaveBeenCalledWith(
      MEMBERS_KEY,
      expect.objectContaining({ scannedAt: Date.now() }),
      expect.any(Number)
    );

    // Asked again, the cached scan answers.
    mockExecute.mockClear();
    await expect(resolveEmbeddedMemberKeys(scope, [member("rare plan")])).resolves.toEqual(
      new Map([[member("rare plan"), "rare plan"]])
    );
    expect(mockExecute).not.toHaveBeenCalled();
  });

  test("leaves out a member no key compiles to, without rescanning within the stale period", async () => {
    mockExecute.mockResolvedValue(rows("other"));
    const gone = "FeedbackRecords.ed_gone_00000000";

    await expect(resolveEmbeddedMemberKeys(scope, [gone])).resolves.toEqual(new Map());
    await expect(resolveEmbeddedMemberKeys(scope, [gone])).resolves.toEqual(new Map());
    expect(mockExecute).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + EMBEDDED_KEYS_STALE_MS + 1);
    stored[KEYS_KEY] = { keys: topKeys, refreshedAt: Date.now() };
    await resolveEmbeddedMemberKeys(scope, [gone]);
    await flush();
    await flush();
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  test("answers from a stale scan at once and rescans in the background under the lock", async () => {
    stored[MEMBERS_KEY] = {
      members: { [member("rare plan")]: "rare plan" },
      scannedAt: Date.now() - EMBEDDED_KEYS_STALE_MS - 1,
    };
    let finishScan: (value: unknown) => void = () => undefined;
    mockExecute.mockReturnValue(new Promise((resolve) => (finishScan = resolve)));

    // The request does not wait on the rescan: it answers what the stale scan knows.
    await expect(
      resolveEmbeddedMemberKeys(scope, [member("rare plan"), member("brand new")])
    ).resolves.toEqual(new Map([[member("rare plan"), "rare plan"]]));
    await flush();
    expect(mockCache.tryLock).toHaveBeenCalledWith(
      "fb:analytics:frd-1:embedded-key-members-lock",
      "1",
      expect.any(Number)
    );
    expect(mockExecute).toHaveBeenCalledTimes(1);

    finishScan(rows("rare plan", "brand new"));
    await flush();
    await flush();
    await expect(resolveEmbeddedMemberKeys(scope, [member("brand new")])).resolves.toEqual(
      new Map([[member("brand new"), "brand new"]])
    );
  });

  test("leaves the background rescan to whoever holds the lock", async () => {
    stored[MEMBERS_KEY] = { members: {}, scannedAt: Date.now() - EMBEDDED_KEYS_STALE_MS - 1 };
    mockCache.tryLock.mockResolvedValue({ ok: true, data: false });

    await resolveEmbeddedMemberKeys(scope, [member("rare plan")]);
    await flush();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  test("scans once for concurrent first resolutions in this process", async () => {
    mockExecute.mockResolvedValue(rows("rare plan"));

    await Promise.all([
      resolveEmbeddedMemberKeys(scope, [member("rare plan")]),
      resolveEmbeddedMemberKeys(scope, [member("rare plan")]),
    ]);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  test("resolves only the top keys when the cache is down, and never scans", async () => {
    mockCache.get.mockResolvedValue({ ok: false, error: { code: "redis_connection_error" } });

    await expect(resolveEmbeddedMemberKeys(scope, [member("rare plan")])).resolves.toEqual(new Map());
    expect(mockExecute).not.toHaveBeenCalled();
  });

  test("a failed scan resolves nothing past the top keys, and is remembered briefly", async () => {
    mockExecute.mockRejectedValue(new Error("cube down"));

    await expect(resolveEmbeddedMemberKeys(scope, [member("rare plan"), member("top_2")])).resolves.toEqual(
      new Map([[member("top_2"), "top_2"]])
    );
    expect(mockCache.set).toHaveBeenCalledWith(
      MEMBERS_KEY,
      { members: {}, scannedAt: Date.now() },
      FAILED_SCAN_RETRY_MS
    );
    await resolveEmbeddedMemberKeys(scope, [member("rare plan")]);
    expect(mockExecute).toHaveBeenCalledTimes(1);
    const [fields] = vi.mocked(logger.warn).mock.calls[0] as [Record<string, unknown>];
    expect(fields).toMatchObject({ errName: "Error" });
    expect(fields).not.toHaveProperty("err");
  });

  test("a token carries the top keys, in one canonical order, for a query naming none outside them", async () => {
    const sorted = [...topKeys].sort();
    await expect(getEmbeddedKeysForQuery(scope, { measures: ["FeedbackRecords.count"] })).resolves.toEqual(
      sorted
    );
    await expect(getEmbeddedKeysForQuery(scope, { dimensions: [member("top_5")] })).resolves.toEqual(sorted);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  describe("rare keys a saved query names", () => {
    const rare = Array.from({ length: 35 }, (_, index) => `rare_${index}`);
    const buckets = groupRareEmbeddedKeys(rare);
    const keysFor = (...keys: string[]) =>
      getEmbeddedKeysForQuery(scope, { measures: ["FeedbackRecords.count"], dimensions: keys.map(member) });

    beforeEach(() => {
      mockExecute.mockResolvedValue(rows(...topKeys, ...rare));
    });

    const bytesOf = (keys: readonly string[]) =>
      keys.reduce((sum, key) => sum + Buffer.byteLength(JSON.stringify(key), "utf8"), 0);
    const bucketOf = (key: string) => buckets.find((bucket) => bucket.includes(key)) ?? [];

    test("group into fixed buckets: deterministic, bounded, every key in exactly one", () => {
      expect(groupRareEmbeddedKeys([])).toEqual([]);
      expect(groupRareEmbeddedKeys([...rare].reverse())).toEqual(buckets);
      expect(buckets.flat().sort()).toEqual([...rare].sort());
      for (const bucket of buckets) {
        expect(bucket.length).toBeLessThanOrEqual(MAX_RARE_EMBEDDED_KEYS);
        expect(bytesOf(bucket)).toBeLessThanOrEqual(MAX_RARE_EMBEDDED_KEYS_BYTES);
        // A bucket never mixes classes.
        expect(new Set(bucket.map(getRareEmbeddedKeyClass)).size).toBe(1);
      }
    });

    test("put each key in one of a fixed number of classes by its hash", () => {
      const classes = new Set(rare.map(getRareEmbeddedKeyClass));
      expect(classes.size).toBeLessThanOrEqual(RARE_EMBEDDED_KEY_CLASSES);
      for (const key of rare) {
        expect(getRareEmbeddedKeyClass(key)).toBe(
          Number.parseInt(member(key).slice(-8), 16) % RARE_EMBEDDED_KEY_CLASSES
        );
      }
      // 35 keys over 8 classes fit one bucket per class.
      expect(buckets.length).toBeLessThanOrEqual(RARE_EMBEDDED_KEY_CLASSES);
    });

    test("a new rare key changes only the buckets of its own class", () => {
      const added = "rare_new";
      const after = groupRareEmbeddedKeys([...rare, added]);
      const addedClass = getRareEmbeddedKeyClass(added);
      const untouched = (all: string[][]) =>
        all.filter((bucket) => getRareEmbeddedKeyClass(bucket[0]) !== addedClass);
      expect(untouched(after)).toEqual(untouched(buckets));
    });

    test("cap each bucket by UTF-8 bytes too, for long and CJK keys", () => {
      const long = Array.from({ length: 30 }, (_, index) => `${index}`.padEnd(128, "x"));
      const cjk = Array.from({ length: 30 }, (_, index) => `${index}${"区".repeat(100)}`);
      for (const bucket of [...groupRareEmbeddedKeys(long), ...groupRareEmbeddedKeys(cjk)]) {
        expect(bytesOf(bucket)).toBeLessThanOrEqual(MAX_RARE_EMBEDDED_KEYS_BYTES);
      }
    });

    test("add the named key's whole bucket and keep every top key, so the model is one per bucket", async () => {
      const [first, second] = buckets[0];
      const tokenA = await keysFor(first);
      const tokenB = await keysFor(second);
      const tokenAB = await keysFor(second, first, "top_7");

      expect(tokenA).toEqual([...topKeys, ...buckets[0]].sort());
      expect(tokenB).toEqual(tokenA);
      expect(tokenAB).toEqual(tokenA);
      expect(tokenA.length).toBeLessThanOrEqual(MAX_TOKEN_EMBEDDED_KEYS);
    });

    test("keys of another bucket compile another model", async () => {
      expect(await keysFor(buckets[1][0])).toEqual([...topKeys, ...buckets[1]].sort());
    });

    test("refuse a query naming rare keys of several buckets, so picks cannot mint new key sets", async () => {
      await expect(keysFor(buckets[0][0], buckets[1][0])).rejects.toBeInstanceOf(
        RareEmbeddedKeysConflictError
      );
      await expect(keysFor(buckets[0][0], buckets[1][0], buckets[2][0])).rejects.toBeInstanceOf(
        RareEmbeddedKeysConflictError
      );
      // Two keys of one bucket, with top keys alongside, still share the bucket's model.
      expect(await keysFor(bucketOf(buckets[0][0])[0], buckets[0][1] ?? buckets[0][0], "top_3")).toEqual(
        [...topKeys, ...buckets[0]].sort()
      );
    });

    test("bound the models a dataset can compile by its buckets, whatever the picks", async () => {
      const tokens = new Set<string>();
      for (const key of rare) tokens.add(JSON.stringify(await keysFor(key)));
      expect(tokens.size).toBe(buckets.length);
    });
  });
});
