import { beforeEach, describe, expect, test, vi } from "vitest";
import { runV3ChartQuery } from "@/app/api/v3/charts/lib/data-operations";
import {
  refuseUnlessFeedbackDatasetAccess,
  requireDashboardsAccess,
} from "@/app/api/v3/lib/dashboards-access";
import type { TDashboardFilter } from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";
import { getDatasetFieldMatcher } from "@/modules/ee/analysis/dashboards/lib/dataset-fields";
import { getV3DashboardChartData } from "./chart-data-operations";
import { ZV3DashboardChartDataQuery } from "./schemas";
import { getDashboardChartsRow } from "./service";

/**
 * A dashboard-bound chart read checks a person's picks before any query (C6, C9): a value its field cannot
 * hold, or more than the total budget, answers 422 naming the pick rather than reaching Cube.
 */

vi.mock("server-only", () => ({}));
vi.mock("node:crypto", async (importOriginal) => await importOriginal());
const { cacheStore } = vi.hoisted(() => ({ cacheStore: new Map<string, unknown>() }));
vi.mock("@/lib/cache", () => ({
  cache: {
    get: vi.fn(async (key: string) => ({ ok: true, data: cacheStore.get(key) ?? null })),
    set: vi.fn(async (key: string, value: unknown) => {
      cacheStore.set(key, value);
      return { ok: true };
    }),
  },
}));
vi.mock("./service", () => ({ getDashboardChartsRow: vi.fn() }));
vi.mock("@/app/api/v3/lib/dashboards-access", () => ({
  requireDashboardsAccess: vi.fn(),
  refuseUnlessFeedbackDatasetAccess: vi.fn(),
}));
vi.mock("@/app/api/v3/charts/lib/data-operations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/api/v3/charts/lib/data-operations")>()),
  applyChartQueryRateLimit: vi.fn(async () => null),
  runV3ChartQuery: vi.fn(async () => new Response("{}", { status: 200 })),
}));
vi.mock("@/modules/ee/analysis/dashboards/lib/dataset-fields", () => ({ getDatasetFieldMatcher: vi.fn() }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));

const SCORE: TDashboardFilter = {
  id: "clfi000000000000000000001",
  field: "FeedbackRecords.valueNumber",
  operator: "gt",
  label: "Score",
};
const SOURCE: TDashboardFilter = {
  id: "clfi000000000000000000002",
  field: "FeedbackRecords.sourceName",
  operator: "equals",
  label: "Source",
};
const chartId = "clch000000000000000000001";

const read = (params: Record<string, string | string[]>) =>
  getV3DashboardChartData({
    dashboardId: "cldb000000000000000000001",
    chartId,
    query: ZV3DashboardChartDataQuery.parse(params),
    authentication: { user: { id: "user_1" } } as never,
    requestId: "req",
    instance: "/api/v3/dashboards",
  });

beforeEach(() => {
  vi.clearAllMocks();
  cacheStore.clear();
  vi.mocked(getDashboardChartsRow).mockResolvedValue({
    id: "cldb000000000000000000001",
    workspaceId: "clws000000000000000000001",
    updatedAt: new Date(),
    filters: [SCORE, SOURCE],
    widgets: [
      {
        chart: {
          id: chartId,
          type: "bar",
          query: { measures: ["FeedbackRecords.count"] },
          feedbackDirectoryId: "clds000000000000000000001",
          updatedAt: new Date(),
        },
      },
    ],
  } as never);
  vi.mocked(requireDashboardsAccess).mockResolvedValue({
    workspaceId: "clws000000000000000000009",
    organizationId: "clorg00000000000000000001",
  } as never);
  vi.mocked(refuseUnlessFeedbackDatasetAccess).mockResolvedValue(null);
  vi.mocked(getDatasetFieldMatcher).mockResolvedValue(() => true);
});

describe("getV3DashboardChartData picks", () => {
  test("runs valid picks", async () => {
    expect((await read({ [`picks[${SCORE.id}]`]: "7" })).status).toBe(200);
    expect(runV3ChartQuery).toHaveBeenCalled();
  });

  test("answers 422 naming the pick for a word on a number field (C6)", async () => {
    const response = await read({ [`picks[${SCORE.id}]`]: "seven" });

    expect(response.status).toBe(422);
    const body = (await response.json()) as { invalid_params: { name: string }[] };
    expect(body.invalid_params[0].name).toBe(`picks[${SCORE.id}]`);
    expect(runV3ChartQuery).not.toHaveBeenCalled();
  });

  test("answers 422 naming the budget for picks over it (C9)", async () => {
    const long = "x".repeat(1000);
    const response = await read({ [`picks[${SOURCE.id}]`]: [long, long, long, long, "x"] });

    expect(response.status).toBe(422);
    expect(JSON.stringify(await response.json())).toContain("MAX_DASHBOARD_FILTER_PICKS_CHARS");
    expect(runV3ChartQuery).not.toHaveBeenCalled();
  });
});

describe("the read decision", () => {
  test("a second widget of the same dashboard version asks neither the workspace nor the dataset again", async () => {
    expect((await read({})).status).toBe(200);
    expect((await read({})).status).toBe(200);

    expect(requireDashboardsAccess).toHaveBeenCalledTimes(1);
    expect(refuseUnlessFeedbackDatasetAccess).toHaveBeenCalledTimes(1);
    expect(runV3ChartQuery).toHaveBeenCalledTimes(2);
  });

  test("a refusal is asked again on the next read", async () => {
    vi.mocked(refuseUnlessFeedbackDatasetAccess).mockResolvedValue(new Response(null, { status: 403 }));

    expect((await read({})).status).toBe(403);
    expect((await read({})).status).toBe(403);
    expect(refuseUnlessFeedbackDatasetAccess).toHaveBeenCalledTimes(2);
  });
});
