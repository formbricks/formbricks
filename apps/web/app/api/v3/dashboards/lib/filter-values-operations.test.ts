import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";
import { cache } from "@/lib/cache";
import { executeTenantScopedQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import { MAX_DASHBOARD_FILTER_PICKS_CHARS } from "@/modules/ee/analysis/dashboards/lib/dashboard-filter-picks";
import type { TDashboardFilter } from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";
import { getDatasetFieldMatcher } from "@/modules/ee/analysis/dashboards/lib/dataset-fields";
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
vi.mock("@/app/api/v3/charts/lib/data-operations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/api/v3/charts/lib/data-operations")>()),
  applyChartQueryRateLimit: vi.fn(async () => null),
  withChartQuerySlot: vi.fn((_context: unknown, run: () => Promise<Response>) => run()),
  getOrganizationReportingTimeZone: vi.fn(async () => "UTC"),
}));
vi.mock("@/lib/cache", () => ({ cache: { get: vi.fn(), set: vi.fn() } }));
vi.mock("@/modules/ee/analysis/api/lib/cube-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/analysis/api/lib/cube-client")>()),
  executeTenantScopedQuery: vi.fn(),
}));
vi.mock("@/modules/ee/analysis/dashboards/lib/dataset-fields", () => ({ getDatasetFieldMatcher: vi.fn() }));
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
