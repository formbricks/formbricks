import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";
import {
  applyV3OperationRateLimit,
  reserveV3OperationRateLimit,
} from "@/app/api/v3/lib/operation-rate-limit";
import { cache } from "@/lib/cache";
import { executeTenantScopedQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import { MAX_DASHBOARD_FILTER_PICKS_CHARS } from "@/modules/ee/analysis/dashboards/lib/dashboard-filter-picks";
import type { TDashboardFilter } from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";
import { getDatasetFieldMatcher } from "@/modules/ee/analysis/dashboards/lib/dataset-fields";
import { getEmbeddedKeysForQuery } from "@/modules/ee/analysis/lib/dataset-embedded-keys";
import { authorizeDashboardRead, refuseUnlessDashboardDatasetReadable } from "./chart-data-operations";
import { MAX_FILTER_VALUE_QUERIES, listV3DashboardFilterValues } from "./filter-values-operations";
import { ZV3DashboardFilterValuesQuery } from "./schemas";
import { getDashboardChartsRow } from "./service";

/**
 * The value-list operation with its collaborators faked: which lists it refuses before Cube (C1, C6, C9),
 * how its cache key moves with the charts (S7), how many Cube queries one list may take (C8), and the
 * two steps a top-N chart takes (S6).
 */

vi.mock("server-only", () => ({}));
// The unit setup fakes hashing; the key's digest is what this suite checks, so hash for real.
vi.mock("node:crypto", async (importOriginal) => await importOriginal());
vi.mock("./service", () => ({ getDashboardChartsRow: vi.fn() }));
vi.mock("./chart-data-operations", () => ({
  authorizeDashboardRead: vi.fn(),
  refuseUnlessDashboardDatasetReadable: vi.fn(),
}));
vi.mock("@/app/api/v3/lib/operation-rate-limit", () => ({
  applyV3OperationRateLimit: vi.fn(async () => null),
  reserveV3OperationRateLimit: vi.fn(async () => ({ settle: settleMock })),
}));
vi.mock("@/app/api/v3/charts/lib/data-operations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/api/v3/charts/lib/data-operations")>()),
  withChartQuerySlot: vi.fn((_context: unknown, run: () => Promise<Response>) => run()),
  getOrganizationReportingTimeZone: vi.fn(async () => "UTC"),
}));
vi.mock("@/lib/cache", () => ({ cache: { get: vi.fn(), set: vi.fn(), tryLock: vi.fn(), del: vi.fn() } }));
const { settleMock } = vi.hoisted(() => ({ settleMock: vi.fn(async () => undefined) }));
vi.mock("@/modules/ee/analysis/api/lib/cube-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/analysis/api/lib/cube-client")>()),
  executeTenantScopedQuery: vi.fn(),
}));
vi.mock("@/modules/ee/analysis/dashboards/lib/dataset-fields", () => ({ getDatasetFieldMatcher: vi.fn() }));
vi.mock("@/modules/ee/analysis/lib/dataset-embedded-keys", () => ({
  getEmbeddedKeysForQuery: vi.fn(async () => ["Plan"]),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));

const SOURCE = "FeedbackRecords.sourceName";
const SCORE = "FeedbackRecords.valueNumber";
const COUNT = "FeedbackRecords.count";
const filterId = (n: number) => `clfi${String(n).padStart(21, "0")}`;
const SOURCE_FILTER: TDashboardFilter = {
  id: filterId(1),
  field: SOURCE,
  operator: "equals",
  label: "Source",
};
const SCORE_FILTER: TDashboardFilter = { id: filterId(2), field: SCORE, operator: "gt", label: "Score" };
const TEXT_FILTER: TDashboardFilter = {
  id: filterId(3),
  field: "FeedbackRecords.valueText",
  operator: "equals",
  label: "Text",
};

const context = {
  authentication: { user: { id: "user_1" } } as never,
  requestId: "req",
  instance: "/api/v3/dashboards",
};

const chartOf = (
  n: number,
  query: TChartQuery,
  datasetId = "clds000000000000000000001",
  updatedAt?: Date
) => ({
  chart: {
    id: `clch${String(n).padStart(21, "0")}`,
    type: "bar",
    query,
    feedbackDirectoryId: datasetId,
    updatedAt: updatedAt ?? new Date("2026-11-01T00:00:00Z"),
  },
});

const rowWith = (
  widgets: ReturnType<typeof chartOf>[],
  filters: TDashboardFilter[] = [SOURCE_FILTER, SCORE_FILTER, TEXT_FILTER]
) => ({
  id: "cldb000000000000000000001",
  workspaceId: "clws000000000000000000001",
  updatedAt: new Date("2026-11-02T00:00:00Z"),
  filters,
  widgets,
});

const list = (filter: string, params: Record<string, string | string[]> = {}) =>
  listV3DashboardFilterValues({
    dashboardId: "cldb000000000000000000001",
    filterId: filter,
    query: ZV3DashboardFilterValuesQuery.parse(params),
    ...context,
  });

const problemOf = async (response: Response) =>
  (await response.json()) as { invalid_params?: { name: string; reason: string }[] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authorizeDashboardRead).mockResolvedValue({
    workspaceId: "clws000000000000000000009",
    organizationId: "clorg00000000000000000001",
  } as never);
  vi.mocked(refuseUnlessDashboardDatasetReadable).mockResolvedValue(null);
  vi.mocked(getDatasetFieldMatcher).mockResolvedValue(() => true);
  vi.mocked(cache.get).mockResolvedValue({ ok: true, data: null } as never);
  vi.mocked(cache.set).mockResolvedValue({ ok: true } as never);
  vi.mocked(cache.tryLock).mockResolvedValue({ ok: true, data: true } as never);
  vi.mocked(cache.del).mockResolvedValue({ ok: true } as never);
  vi.mocked(applyV3OperationRateLimit).mockResolvedValue(null);
  vi.mocked(reserveV3OperationRateLimit).mockResolvedValue({ settle: settleMock });
  vi.mocked(executeTenantScopedQuery).mockResolvedValue([] as never);
});

describe("refused before Cube", () => {
  test("a filter on free text takes a typed value: no list, 422 (C1)", async () => {
    vi.mocked(getDashboardChartsRow).mockResolvedValue(rowWith([chartOf(1, { measures: [COUNT] })]) as never);

    const response = await list(TEXT_FILTER.id);

    expect(response.status).toBe(422);
    expect(executeTenantScopedQuery).not.toHaveBeenCalled();
  });

  test("picks over the total budget answer 422 naming it (C9)", async () => {
    vi.mocked(getDashboardChartsRow).mockResolvedValue(rowWith([chartOf(1, { measures: [COUNT] })]) as never);
    const long = "x".repeat(1000);

    const response = await list(SOURCE_FILTER.id, {
      [`picks[${TEXT_FILTER.id}]`]: [long, long, long, long, "x"],
    });

    expect(response.status).toBe(422);
    expect(JSON.stringify(await problemOf(response))).toContain("MAX_DASHBOARD_FILTER_PICKS_CHARS");
    expect(MAX_DASHBOARD_FILTER_PICKS_CHARS).toBe(4000);
    expect(executeTenantScopedQuery).not.toHaveBeenCalled();
  });

  test("a pick its field cannot hold answers 422 naming the pick, not 502 from Cube (C6)", async () => {
    vi.mocked(getDashboardChartsRow).mockResolvedValue(rowWith([chartOf(1, { measures: [COUNT] })]) as never);

    const response = await list(SOURCE_FILTER.id, { [`picks[${SCORE_FILTER.id}]`]: "seven" });

    expect(response.status).toBe(422);
    expect((await problemOf(response)).invalid_params?.[0].name).toBe(`picks[${SCORE_FILTER.id}]`);
    expect(executeTenantScopedQuery).not.toHaveBeenCalled();
  });

  test(`more than MAX_FILTER_VALUE_QUERIES Cube queries for one list answer 422 naming it (C8)`, async () => {
    const topN = (n: number) => chartOf(n, { measures: [COUNT], dimensions: [SOURCE], limit: 5 });
    // Each top-N chart takes up to two queries.
    const atCap = Array.from({ length: MAX_FILTER_VALUE_QUERIES / 2 }, (_, i) => topN(i));
    vi.mocked(getDashboardChartsRow).mockResolvedValue(rowWith(atCap) as never);
    expect((await list(SOURCE_FILTER.id)).status).toBe(200);

    vi.mocked(getDashboardChartsRow).mockResolvedValue(rowWith([...atCap, topN(99)]) as never);
    vi.mocked(executeTenantScopedQuery).mockClear();
    const response = await list(SOURCE_FILTER.id);
    expect(response.status).toBe(422);
    expect(JSON.stringify(await problemOf(response))).toContain("MAX_FILTER_VALUE_QUERIES");
    expect(executeTenantScopedQuery).not.toHaveBeenCalled();
  });
});

describe("the cache key (S7)", () => {
  const keyFor = async (updatedAt: Date) => {
    vi.mocked(getDashboardChartsRow).mockResolvedValue(
      rowWith([chartOf(1, { measures: [COUNT] }, undefined, updatedAt)]) as never
    );
    vi.mocked(cache.get).mockClear();
    await list(SOURCE_FILTER.id);
    return vi.mocked(cache.get).mock.calls[0][0];
  };

  test("moves when a widget's chart is edited, though the dashboard itself is not", async () => {
    const before = await keyFor(new Date("2026-11-01T00:00:00Z"));
    expect(await keyFor(new Date("2026-11-01T00:00:00Z"))).toBe(before);
    expect(await keyFor(new Date("2026-11-03T00:00:00Z"))).not.toBe(before);
  });
});

describe("checking the datasets (C8)", () => {
  test("asks for every dataset with the field at once, not one after another", async () => {
    vi.mocked(getDashboardChartsRow).mockResolvedValue(
      rowWith([
        chartOf(1, { measures: [COUNT] }, "clds000000000000000000001"),
        chartOf(2, { measures: [COUNT] }, "clds000000000000000000002"),
      ]) as never
    );
    let pending = 0;
    let most = 0;
    vi.mocked(refuseUnlessDashboardDatasetReadable).mockImplementation(async () => {
      pending += 1;
      most = Math.max(most, pending);
      await new Promise((resolve) => setTimeout(resolve, 5));
      pending -= 1;
      return null;
    });

    expect((await list(SOURCE_FILTER.id)).status).toBe(200);
    expect(most).toBe(2);
  });
});

describe("a top-N chart (S6)", () => {
  test("lists only the groups the chart shows: its own query first, then nothing more for its grouped field", async () => {
    vi.mocked(getDashboardChartsRow).mockResolvedValue(
      rowWith([
        chartOf(1, { measures: [COUNT], dimensions: [SOURCE], order: [[COUNT, "desc"]], limit: 1 }),
      ]) as never
    );
    vi.mocked(executeTenantScopedQuery).mockResolvedValue([{ [SOURCE]: "Web", [COUNT]: 9 }] as never);

    const response = await list(SOURCE_FILTER.id);

    expect(response.status).toBe(200);
    expect(((await response.json()) as { data: unknown }).data).toEqual({
      values: [{ value: "Web" }],
      hasMore: false,
    });
    expect(executeTenantScopedQuery).toHaveBeenCalledTimes(1);
    expect(vi.mocked(executeTenantScopedQuery).mock.calls[0][0].query).toMatchObject({ limit: 1 });
  });
});

describe("what a list costs", () => {
  const DS = (n: number) => `clds${String(n).padStart(21, "0")}`;
  const topN = (n: number, datasetId = DS(1)) =>
    chartOf(n, { measures: [COUNT], dimensions: ["FeedbackRecords.metadataCountry"], limit: 5 }, datasetId);
  const LIST = { values: [{ value: "Web" }], hasMore: false };

  test("the default API budget is charged before the cache is read, so a cached list is charged too", async () => {
    vi.mocked(getDashboardChartsRow).mockResolvedValue(rowWith([chartOf(1, { measures: [COUNT] })]) as never);
    vi.mocked(cache.get).mockResolvedValue({ ok: true, data: LIST } as never);

    expect((await list(SOURCE_FILTER.id)).status).toBe(200);
    expect(vi.mocked(applyV3OperationRateLimit).mock.calls[0][0]).toMatchObject({
      config: expect.objectContaining({ namespace: "api:v3" }),
    });
    expect(vi.mocked(applyV3OperationRateLimit).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(cache.get).mock.invocationCallOrder[0]
    );
    expect(reserveV3OperationRateLimit).not.toHaveBeenCalled();

    vi.mocked(applyV3OperationRateLimit).mockResolvedValueOnce(new Response(null, { status: 429 }));
    vi.mocked(cache.get).mockClear();
    expect((await list(SOURCE_FILTER.id)).status).toBe(429);
    expect(cache.get).not.toHaveBeenCalled();
  });

  test("a miss reserves one chart-query unit per Cube query it may run, and gives back the rest", async () => {
    vi.mocked(getDashboardChartsRow).mockResolvedValue(
      rowWith([
        chartOf(1, { measures: [COUNT] }, DS(1)),
        chartOf(2, { measures: [COUNT] }, DS(2)),
        topN(3),
      ]) as never
    );
    // The top-N chart shows no group, so its second step never runs.
    expect((await list(SOURCE_FILTER.id)).status).toBe(200);

    expect(vi.mocked(reserveV3OperationRateLimit).mock.calls[0][0]).toMatchObject({
      config: expect.objectContaining({ namespace: "api:v3:charts:queries" }),
      requested: 4,
    });
    expect(executeTenantScopedQuery).toHaveBeenCalledTimes(3);
    expect(settleMock).toHaveBeenCalledWith(3);
  });

  test("a spent chart-query budget answers 429 before Cube", async () => {
    vi.mocked(getDashboardChartsRow).mockResolvedValue(rowWith([chartOf(1, { measures: [COUNT] })]) as never);
    vi.mocked(reserveV3OperationRateLimit).mockResolvedValueOnce({
      refused: new Response(null, { status: 429 }),
    });

    expect((await list(SOURCE_FILTER.id)).status).toBe(429);
    expect(executeTenantScopedQuery).not.toHaveBeenCalled();
  });

  test("two requests for the same list at once run its Cube queries once", async () => {
    vi.mocked(getDashboardChartsRow).mockResolvedValue(
      rowWith([chartOf(1, { measures: [COUNT] }, DS(1)), chartOf(2, { measures: [COUNT] }, DS(2))]) as never
    );
    vi.mocked(executeTenantScopedQuery).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return [{ [SOURCE]: "Web" }] as never;
    });

    const [first, second] = await Promise.all([list(SOURCE_FILTER.id), list(SOURCE_FILTER.id)]);

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(await second.json()).toEqual(await first.json());
    expect(executeTenantScopedQuery).toHaveBeenCalledTimes(2);
  });

  test("while another instance builds the list, its cached result is waited for instead of asking Cube", async () => {
    vi.mocked(getDashboardChartsRow).mockResolvedValue(rowWith([chartOf(1, { measures: [COUNT] })]) as never);
    vi.mocked(cache.tryLock).mockResolvedValue({ ok: true, data: false } as never);
    vi.mocked(cache.get)
      .mockResolvedValueOnce({ ok: true, data: null } as never)
      .mockResolvedValueOnce({ ok: true, data: null } as never)
      .mockResolvedValue({ ok: true, data: LIST } as never);

    const response = await list(SOURCE_FILTER.id);

    expect(response.status).toBe(200);
    expect(((await response.json()) as { data: unknown }).data).toEqual(LIST);
    expect(executeTenantScopedQuery).not.toHaveBeenCalled();
  });

  test("at most five of one list's Cube queries run at once, merged and bounded together", async () => {
    vi.mocked(getDashboardChartsRow).mockResolvedValue(
      rowWith([
        ...[1, 2, 3, 4].map((n) => chartOf(n, { measures: [COUNT] }, DS(n))),
        ...[5, 6, 7, 8].map((n) => topN(n, DS(n))),
      ]) as never
    );
    let running = 0;
    let most = 0;
    vi.mocked(executeTenantScopedQuery).mockImplementation(async () => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return [] as never;
    });

    expect((await list(SOURCE_FILTER.id)).status).toBe(200);
    expect(executeTenantScopedQuery).toHaveBeenCalledTimes(8);
    expect(most).toBe(5);
  });
});

describe("the embedded keys of a list's Cube tokens", () => {
  test("are resolved once per dataset for the whole list, and passed to every query", async () => {
    const topN = (n: number) =>
      chartOf(n, { measures: [COUNT], dimensions: ["FeedbackRecords.metadataCountry"], limit: 5 });
    vi.mocked(getDashboardChartsRow).mockResolvedValue(
      rowWith([chartOf(1, { measures: [COUNT] }), topN(2), topN(3), topN(4)]) as never
    );

    expect((await list(SOURCE_FILTER.id)).status).toBe(200);

    expect(executeTenantScopedQuery).toHaveBeenCalledTimes(4);
    expect(getEmbeddedKeysForQuery).toHaveBeenCalledTimes(1);
    for (const [call] of vi.mocked(executeTenantScopedQuery).mock.calls) {
      expect(call.embeddedKeys).toEqual(["Plan"]);
    }
  });
});
