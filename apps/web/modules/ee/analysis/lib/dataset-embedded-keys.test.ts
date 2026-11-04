import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  EMBEDDED_DATA_KEY_DIMENSION,
  EMBEDDED_KEYS_STALE_MS,
  getDatasetEmbeddedKeys,
  getEmbeddedKeysForQuery,
  resolveEmbeddedMemberKeys,
} from "./dataset-embedded-keys";
import { MAX_EMBEDDED_KEYS } from "./embedded-data-fields";
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

describe("getDatasetEmbeddedKeys (ENG-6893)", () => {
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
});

describe("a saved query's keys outside the top keys (ENG-6893)", () => {
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
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  test("resolves only the top keys when the cache is down, and never scans", async () => {
    mockCache.get.mockResolvedValue({ ok: false, error: { code: "redis_connection_error" } });

    await expect(resolveEmbeddedMemberKeys(scope, [member("rare plan")])).resolves.toEqual(new Map());
    expect(mockExecute).not.toHaveBeenCalled();
  });

  test("a failed scan resolves nothing past the top keys rather than failing", async () => {
    mockExecute.mockRejectedValue(new Error("cube down"));

    await expect(resolveEmbeddedMemberKeys(scope, [member("rare plan"), member("top_2")])).resolves.toEqual(
      new Map([[member("top_2"), "top_2"]])
    );
  });

  test("a token carries the top keys for a query naming none outside them", async () => {
    await expect(getEmbeddedKeysForQuery(scope, { measures: ["FeedbackRecords.count"] })).resolves.toEqual(
      topKeys
    );
    await expect(getEmbeddedKeysForQuery(scope, { dimensions: [member("top_5")] })).resolves.toEqual(topKeys);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  test("a token puts a saved query's rarer key first and stays within the cap", async () => {
    mockExecute.mockResolvedValue(rows(...topKeys, "rare plan"));

    const keys = await getEmbeddedKeysForQuery(scope, {
      dimensions: [member("rare plan")],
      filters: [{ member: member("top_3"), operator: "equals", values: ["x"] }],
    });

    expect(keys).toHaveLength(MAX_EMBEDDED_KEYS);
    expect(keys.slice(0, 2)).toEqual(["rare plan", "top_3"]);
    expect(keys).not.toContain("top_99");
  });
});
