import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import {
  refuseUnlessFeedbackDatasetAccess,
  requireDashboardsAccess,
} from "@/app/api/v3/lib/dashboards-access";
import { problemForbidden } from "@/app/api/v3/lib/response";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { CubeQueryError } from "@/modules/ee/analysis/api/lib/cube-client";
import { DATE_RANGE_REASON } from "@/modules/ee/analysis/lib/chart-query-validator";
import { runChartQuery } from "@/modules/ee/analysis/lib/run-chart-query";
import { loadAuthorizedChart } from "./access";
import { getV3ChartData, previewV3Chart } from "./data-operations";
import { listV3ChartFieldValues } from "./field-operations";
import { ZV3ChartData } from "./resources";
import type { TChartResourceRow } from "./service";

/**
 * The chart-query budget (ENG-6586): preview and data spend from one 600/min bucket per user or API
 * key, charged inside the operation so REST and MCP share it, and checked before anything else runs.
 */

vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/app/api/v3/lib/dashboards-access", () => ({
  requireDashboardsAccess: vi.fn(),
  refuseUnlessFeedbackDatasetAccess: vi.fn(),
}));
vi.mock("./access", () => ({ loadAuthorizedChart: vi.fn() }));
vi.mock("@/modules/ee/analysis/lib/run-chart-query", () => ({ runChartQuery: vi.fn() }));
vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

const context = {
  authentication: { apiKeyId: "key_1", workspacePermissions: [] } as never,
  requestId: "req",
  instance: "/api/v3/charts",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(applyRateLimit).mockRejectedValue(
    new TooManyRequestsError("Maximum number of requests reached", 30)
  );
});

describe("chart query budget", () => {
  test("preview, data and field values all spend from the chart-query bucket, per key, and stop at 429", async () => {
    const responses = [
      await previewV3Chart({
        body: {
          workspaceId: "clws000000000000000000001",
          datasetId: "clds000000000000000000001",
          type: "bar",
          query: {},
        },
        ...context,
      }),
      await getV3ChartData({ chartId: "clch000000000000000000001", query: {}, ...context }),
      await listV3ChartFieldValues({
        field: "FeedbackRecords.sourceName",
        query: { workspaceId: "clws000000000000000000001", datasetId: "clds000000000000000000001" },
        ...context,
      }),
    ];

    for (const response of responses) {
      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("30");
    }
    expect(vi.mocked(applyRateLimit).mock.calls).toEqual([
      [rateLimitConfigs.api.v3ChartQueries, "key_1"],
      [rateLimitConfigs.api.v3ChartQueries, "key_1"],
      [rateLimitConfigs.api.v3ChartQueries, "key_1"],
    ]);
    expect(requireDashboardsAccess).not.toHaveBeenCalled();
  });
});

const COLLECTED_AT = "FeedbackRecords.collectedAt";
const workspaceId = "clws000000000000000000001";
const internalWorkspaceId = "clws000000000000000000009";
const organizationId = "clorg00000000000000000001";
const datasetId = "clds000000000000000000001";
const chartId = "clch000000000000000000001";
const access = { workspaceId: internalWorkspaceId, organizationId };
const BY_SOURCE = { measures: ["FeedbackRecords.count"], dimensions: ["FeedbackRecords.sourceName"] };

/** Two years by the hour: ~17,500 buckets, past the 10,000 limit. */
const hourlyOver = (dateRange: unknown) => ({
  measures: ["FeedbackRecords.count"],
  timeDimensions: [{ dimension: COLLECTED_AT, granularity: "hour", dateRange }],
});

type TProblem = {
  code: string;
  detail: string;
  invalid_params?: { name: string; reason: string; code?: string }[];
};
const problemOf = async (response: Response) => (await response.json()) as TProblem;
const sentQuery = () => vi.mocked(runChartQuery).mock.calls[0][0].query;

describe("chart queries within budget", () => {
  beforeEach(() => {
    vi.mocked(applyRateLimit).mockResolvedValue(undefined as never);
    vi.mocked(requireDashboardsAccess).mockResolvedValue(access);
    vi.mocked(refuseUnlessFeedbackDatasetAccess).mockResolvedValue(null);
    vi.mocked(runChartQuery).mockImplementation(async ({ query }) => ({
      rows: [{ "FeedbackRecords.sourceName": "Web", "FeedbackRecords.count": 3 }],
      optionLabels: undefined as never,
      fieldLabels: { "FeedbackRecords.count": "Responses" },
      effectiveQuery: query,
    }));
  });

  describe("previewV3Chart", () => {
    const preview = (overrides: Record<string, unknown> = {}, authentication = context.authentication) =>
      previewV3Chart({
        body: { workspaceId, datasetId, type: "bar", query: BY_SOURCE, ...overrides } as never,
        ...context,
        authentication,
      });

    test("runs the query in the authorized workspace's tenant and returns rows, labels and the query run", async () => {
      const response = await preview();

      expect(response.status).toBe(200);
      const { data } = (await response.json()) as { data: unknown };
      expect(ZV3ChartData.parse(data)).toEqual({
        rows: [{ "FeedbackRecords.sourceName": "Web", "FeedbackRecords.count": 3 }],
        optionLabels: {},
        fieldLabels: { "FeedbackRecords.count": "Responses" },
        query: BY_SOURCE,
      });
      expect(requireDashboardsAccess).toHaveBeenCalledWith(
        context.authentication,
        workspaceId,
        "read",
        "req",
        context.instance
      );
      expect(refuseUnlessFeedbackDatasetAccess).toHaveBeenCalledWith(
        context.authentication,
        access,
        datasetId,
        "read",
        "req",
        context.instance
      );
      expect(runChartQuery).toHaveBeenCalledWith({
        query: BY_SOURCE,
        datasetId,
        workspaceId: internalWorkspaceId,
        organizationId,
        actor: { type: "apiKey", id: "key_1" },
        source: "v3.charts.preview",
      });
    });

    test("applies a requested range to collectedAt", async () => {
      await preview({
        query: {
          measures: ["FeedbackRecords.count"],
          timeDimensions: [{ dimension: COLLECTED_AT, granularity: "day", dateRange: "last 90 days" }],
        },
        dateRange: "last 7 days",
      });

      expect(sentQuery().timeDimensions).toEqual([
        { dimension: COLLECTED_AT, granularity: "day", dateRange: "last 7 days" },
      ]);
    });

    test("refuses an invalid query and an invalid range together with 422, before running anything", async () => {
      const response = await preview({
        query: { measures: ["FeedbackRecords.tenantId"], ungrouped: true },
        dateRange: "since the dawn of time",
      });

      expect(response.status).toBe(422);
      const problem = await problemOf(response);
      expect(problem.code).toBe("unprocessable_content");
      expect(problem.invalid_params?.map((param) => param.name).sort()).toEqual(
        ["dateRange", "query.measures[0]", "query.ungrouped"].sort()
      );
      expect(problem.invalid_params).toContainEqual({ name: "dateRange", reason: DATE_RANGE_REASON });
      expect(runChartQuery).not.toHaveBeenCalled();
    });

    test("refuses only the range when the query is valid", async () => {
      const response = await preview({ dateRange: { from: "2026-02-01", to: "2026-01-01" } });

      expect(response.status).toBe(422);
      expect((await problemOf(response)).invalid_params).toEqual([
        { name: "dateRange", reason: DATE_RANGE_REASON },
      ]);
      expect(runChartQuery).not.toHaveBeenCalled();
    });

    test("names a saved range too wide for its granularity after the query's own time dimension", async () => {
      const response = await preview({ query: hourlyOver(["2020-01-01", "2026-12-31"]) });

      expect(response.status).toBe(422);
      expect((await problemOf(response)).invalid_params).toEqual([
        expect.objectContaining({ name: "query.timeDimensions[0].dateRange", code: "limit_exceeded" }),
      ]);
      expect(runChartQuery).not.toHaveBeenCalled();
    });

    test("names a requested range too wide for the query's granularity as dateRange", async () => {
      const response = await preview({
        query: hourlyOver("last 7 days"),
        dateRange: { from: "2025-01-01", to: "2026-12-31" },
      });

      expect(response.status).toBe(422);
      expect((await problemOf(response)).invalid_params).toEqual([
        expect.objectContaining({ name: "dateRange", code: "limit_exceeded" }),
      ]);
      expect(runChartQuery).not.toHaveBeenCalled();
    });

    test("checks the limit on the query that runs: a big number drops the granularity, so it is not limited", async () => {
      const response = await preview({ type: "big_number", query: hourlyOver(["2020-01-01", "2026-12-31"]) });

      expect(response.status).toBe(200);
      expect(sentQuery().timeDimensions).toEqual([
        { dimension: COLLECTED_AT, dateRange: ["2020-01-01", "2026-12-31"] },
      ]);
    });

    test("runs nothing for a caller refused by the workspace or the dataset", async () => {
      vi.mocked(requireDashboardsAccess).mockResolvedValueOnce(problemForbidden("req", undefined, "/"));
      expect((await preview()).status).toBe(403);
      expect(refuseUnlessFeedbackDatasetAccess).not.toHaveBeenCalled();

      vi.mocked(refuseUnlessFeedbackDatasetAccess).mockResolvedValueOnce(
        problemForbidden("req", "You are not authorized to use this Feedback Dataset", "/")
      );
      expect((await preview()).status).toBe(403);

      expect(runChartQuery).not.toHaveBeenCalled();
    });

    test("answers 401 when no actor can be attributed", async () => {
      expect((await preview({}, null as never)).status).toBe(401);
      expect(runChartQuery).not.toHaveBeenCalled();
    });

    test("answers a Cube failure with a 502 that says whether it timed out and never carries Cube's error", async () => {
      vi.mocked(runChartQuery).mockRejectedValueOnce(new CubeQueryError(true));
      const timedOut = await preview();
      expect(timedOut.status).toBe(502);
      const timedOutProblem = await problemOf(timedOut);
      expect(timedOutProblem.code).toBe("bad_gateway");
      expect(timedOutProblem.detail).toBe(
        "The chart query took too long and was stopped. Narrow the date range or the grouping and try again."
      );

      vi.mocked(runChartQuery).mockRejectedValueOnce(new CubeQueryError(false));
      const failed = await preview();
      expect(failed.status).toBe(502);
      expect((await problemOf(failed)).detail).toBe("The chart query could not be run. Try again shortly.");
    });

    test("maps any other failure to a 500", async () => {
      vi.mocked(runChartQuery).mockRejectedValueOnce(new Error("relation secret_table"));

      const response = await preview();

      expect(response.status).toBe(500);
      expect(JSON.stringify(await response.json())).not.toContain("secret_table");
    });
  });

  describe("getV3ChartData", () => {
    const chartOf = (query: unknown, type = "bar") =>
      ({
        id: chartId,
        workspaceId: internalWorkspaceId,
        feedbackDirectoryId: datasetId,
        type,
        query,
      }) as TChartResourceRow;

    const read = (query: Record<string, string> = {}) =>
      getV3ChartData({ chartId, query: query as never, ...context });

    const RANGED = {
      measures: ["FeedbackRecords.count"],
      timeDimensions: [{ dimension: COLLECTED_AT, granularity: "week", dateRange: "last 90 days" }],
    };

    beforeEach(() => {
      vi.mocked(loadAuthorizedChart).mockResolvedValue({ row: chartOf(RANGED), access });
    });

    test("runs the saved query on the chart's own dataset, in its workspace, as a data read", async () => {
      const response = await read();

      expect(response.status).toBe(200);
      expect(loadAuthorizedChart).toHaveBeenCalledWith(chartId, "read", context);
      expect(refuseUnlessFeedbackDatasetAccess).toHaveBeenCalledWith(
        context.authentication,
        access,
        datasetId,
        "read",
        "req",
        context.instance
      );
      expect(runChartQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: RANGED,
          datasetId,
          workspaceId: internalWorkspaceId,
          organizationId,
          source: "v3.charts.data",
        })
      );
    });

    test("replaces the saved range with a requested preset or pair, and removes it for all-time", async () => {
      await read({ dateRange: "last 7 days" });
      await read({ from: "2026-01-01", to: "2026-01-31" });
      await read({ dateRange: "all-time" });

      expect(vi.mocked(runChartQuery).mock.calls.map(([run]) => run.query.timeDimensions)).toEqual([
        [{ dimension: COLLECTED_AT, granularity: "week", dateRange: "last 7 days" }],
        [{ dimension: COLLECTED_AT, granularity: "week", dateRange: ["2026-01-01", "2026-01-31"] }],
        [{ dimension: COLLECTED_AT, granularity: "week" }],
      ]);
    });

    test("refuses a half-given pair, or a preset mixed with a pair, as an invalid dateRange", async () => {
      const invalidRanges: Record<string, string>[] = [
        { from: "2026-01-01" },
        { to: "2026-01-01" },
        { dateRange: "today", from: "2026-01-01", to: "2026-01-02" },
        { dateRange: "yesterday-ish" },
      ];
      for (const query of invalidRanges) {
        const response = await read(query);
        expect(response.status).toBe(422);
        expect((await problemOf(response)).invalid_params).toEqual([
          { name: "dateRange", reason: DATE_RANGE_REASON },
        ]);
      }
      expect(runChartQuery).not.toHaveBeenCalled();
    });

    test("names a requested range too wide for the chart's granularity as dateRange", async () => {
      vi.mocked(loadAuthorizedChart).mockResolvedValue({ row: chartOf(hourlyOver("last 7 days")), access });

      const response = await read({ from: "2025-01-01", to: "2026-12-31" });

      expect(response.status).toBe(422);
      expect((await problemOf(response)).invalid_params).toEqual([
        expect.objectContaining({ name: "dateRange", code: "limit_exceeded" }),
      ]);
      expect(runChartQuery).not.toHaveBeenCalled();
    });

    test("lets a requested range replace a saved one too wide for the limit, and names the saved one otherwise", async () => {
      vi.mocked(loadAuthorizedChart).mockResolvedValue({
        row: chartOf(hourlyOver(["2024-01-01", "2025-12-31"])),
        access,
      });

      expect((await read({ dateRange: "last 7 days" })).status).toBe(200);

      const unreplaced = await read();
      expect(unreplaced.status).toBe(422);
      expect((await problemOf(unreplaced)).invalid_params).toEqual([
        expect.objectContaining({ name: "query.timeDimensions[0].dateRange", code: "limit_exceeded" }),
      ]);
      expect(runChartQuery).toHaveBeenCalledTimes(1);
    });

    test("refuses a stored query the validator no longer accepts with 422", async () => {
      vi.mocked(loadAuthorizedChart).mockResolvedValue({
        row: chartOf({ measures: ["FeedbackRecords.tenantId"] }),
        access,
      });

      const response = await read();

      expect(response.status).toBe(422);
      expect((await problemOf(response)).invalid_params?.map((param) => param.name)).toEqual([
        "query.measures[0]",
      ]);
      expect(runChartQuery).not.toHaveBeenCalled();
    });

    test("runs nothing for a chart the caller cannot read, or whose dataset they cannot use", async () => {
      vi.mocked(loadAuthorizedChart).mockResolvedValueOnce(problemForbidden("req", undefined, "/"));
      expect((await read()).status).toBe(403);
      expect(refuseUnlessFeedbackDatasetAccess).not.toHaveBeenCalled();

      vi.mocked(refuseUnlessFeedbackDatasetAccess).mockResolvedValueOnce(
        problemForbidden("req", undefined, "/")
      );
      expect((await read()).status).toBe(403);

      expect(runChartQuery).not.toHaveBeenCalled();
    });

    test("answers a Cube failure with 502 and anything else with 500", async () => {
      vi.mocked(runChartQuery).mockRejectedValueOnce(new CubeQueryError(false));
      const failed = await read();
      expect(failed.status).toBe(502);
      expect((await problemOf(failed)).code).toBe("bad_gateway");

      vi.mocked(loadAuthorizedChart).mockRejectedValueOnce(new Error("boom"));
      expect((await read()).status).toBe(500);
    });
  });
});
