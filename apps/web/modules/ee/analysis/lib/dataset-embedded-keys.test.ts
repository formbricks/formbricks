import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  EMBEDDED_DATA_KEY_DIMENSION,
  EMBEDDED_KEYS_STALE_MS,
  getDatasetEmbeddedKeys,
} from "./dataset-embedded-keys";

const { mockCache, mockExecute } = vi.hoisted(() => ({
  mockCache: { get: vi.fn(), set: vi.fn(), tryLock: vi.fn() },
  mockExecute: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/cache", () => ({ cache: mockCache }));
vi.mock("@/modules/ee/analysis/api/lib/cube-client", () => ({ executeTenantScopedQuery: mockExecute }));

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
