import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import {
  refuseUnlessFeedbackDatasetAccess,
  requireDashboardsAccess,
} from "@/app/api/v3/lib/dashboards-access";
import { problemForbidden } from "@/app/api/v3/lib/response";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { acquireInFlightSlot, releaseInFlightSlot } from "@/modules/core/rate-limit/in-flight";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { CubeQueryError } from "@/modules/ee/analysis/api/lib/cube-client";
import { REQUESTED_DATE_RANGE_REASON } from "@/modules/ee/analysis/lib/chart-query-validator";
import { runChartQuery } from "@/modules/ee/analysis/lib/run-chart-query";
import { loadAuthorizedChart } from "./access";
import { getV3ChartData, previewV3Chart, runV3ChartQuery } from "./data-operations";
import { loadDatasetChartFields } from "./dataset-fields";
import { listV3ChartFieldValues } from "./field-operations";
import { ZV3ChartData } from "./resources";
import type { TChartResourceRow } from "./service";

/**
 * The chart-query budget (ENG-6586): preview and data spend from one 600/min bucket per user or API
 * key, charged inside the operation so REST and MCP share it, and checked before anything else runs.
 */

vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/core/rate-limit/in-flight", () => ({
  acquireInFlightSlot: vi.fn(),
  releaseInFlightSlot: vi.fn(),
}));
vi.mock("@/app/api/v3/lib/dashboards-access", () => ({
  requireDashboardsAccess: vi.fn(),
  refuseUnlessFeedbackDatasetAccess: vi.fn(),
}));
vi.mock("./dataset-fields", () => ({ loadDatasetChartFields: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./access", () => ({ loadAuthorizedChart: vi.fn() }));
vi.mock("@/modules/ee/analysis/lib/run-chart-query", () => ({ runChartQuery: vi.fn() }));
vi.mock("@/lib/organization/service", () => ({
  getOrganization: vi.fn(async () => ({ displayTimeZone: "UTC" })),
}));
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
    vi.mocked(acquireInFlightSlot).mockResolvedValue({
      allowed: true,
      slot: { key: "k", member: "m", released: false },
    });
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

    test("runs Cube in one of the caller's in-flight slots, and answers 429 without running when none is free", async () => {
      await preview();
      expect(acquireInFlightSlot).toHaveBeenCalledWith(rateLimitConfigs.api.v3ChartQueriesInFlight, "key_1");
      expect(releaseInFlightSlot).toHaveBeenCalledTimes(1);

      vi.mocked(runChartQuery).mockClear();
      vi.mocked(acquireInFlightSlot).mockResolvedValueOnce({ allowed: false });
      const busy = await preview();
      expect(busy.status).toBe(429);
      expect(busy.headers.get("Retry-After")).toBe("1");
      expect(runChartQuery).not.toHaveBeenCalled();
    });

    test("previews a query with a relative range older charts were saved with, as the builder re-runs one", async () => {
      const response = await preview({
        query: {
          measures: ["FeedbackRecords.count"],
          timeDimensions: [{ dimension: COLLECTED_AT, granularity: "month", dateRange: "last 3 months" }],
        },
      });
      expect(response.status).toBe(200);
      expect(sentQuery().timeDimensions).toEqual([
        { dimension: COLLECTED_AT, granularity: "month", dateRange: "last 3 months" },
      ]);
    });

    test("holds an older chart's relative range to the bucket limit, as an explicit pair is", async () => {
      const response = await preview({
        query: {
          measures: ["FeedbackRecords.count"],
          timeDimensions: [{ dimension: COLLECTED_AT, granularity: "hour", dateRange: "last 999 years" }],
        },
      });
      expect(response.status).toBe(422);
      expect((await problemOf(response)).invalid_params).toEqual([
        expect.objectContaining({ name: "query.timeDimensions[0].dateRange", code: "limit_exceeded" }),
      ]);
      expect(runChartQuery).not.toHaveBeenCalled();
    });

    test("holds no slot for a query the validator refuses", async () => {
      vi.mocked(acquireInFlightSlot).mockClear();
      expect((await preview({ query: { measures: ["FeedbackRecords.nope"] } })).status).toBe(422);
      expect(acquireInFlightSlot).not.toHaveBeenCalled();
    });

    test("names each embedded-data member the query groups by with its key's own name", async () => {
      const plan = "FeedbackRecords.ed_plan_64879f7d";
      vi.mocked(loadDatasetChartFields).mockResolvedValueOnce({
        embeddedFields: [
          { name: plan, key: "Plan" },
          { name: "FeedbackRecords.ed_tier_0a1b2c3d", key: "Tier" },
        ],
      });

      const response = await preview({
        query: { measures: ["FeedbackRecords.count"], dimensions: [plan] },
      });

      expect(response.status).toBe(200);
      const { data } = (await response.json()) as { data: { memberLabels: unknown } };
      // Only the members the query names: the dataset's other keys stay out.
      expect(data.memberLabels).toEqual({ [plan]: "Plan" });
    });

    test("runs the query in the authorized workspace's tenant and returns rows, labels and the query run", async () => {
      const response = await preview();

      expect(response.status).toBe(200);
      const { data } = (await response.json()) as { data: unknown };
      expect(ZV3ChartData.parse(data)).toEqual({
        rows: [{ "FeedbackRecords.sourceName": "Web", "FeedbackRecords.count": 3 }],
        optionLabels: {},
        fieldLabels: { "FeedbackRecords.count": "Responses" },
        memberLabels: {},
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

    test("replaces the range on collectedAt with the requested one, keeping the granularity", async () => {
      await preview({
        query: {
          measures: ["FeedbackRecords.count"],
          timeDimensions: [
            { dimension: COLLECTED_AT, granularity: "day", dateRange: ["2026-01-01", "2026-03-31"] },
          ],
        },
        dateRange: { from: "2026-03-01", to: "2026-04-30" },
      });

      expect(sentQuery().timeDimensions).toEqual([
        { dimension: COLLECTED_AT, granularity: "day", dateRange: ["2026-03-01", "2026-04-30"] },
      ]);
    });

    test("asks Cube for a requested range that does not overlap the saved one", async () => {
      await preview({
        query: {
          measures: ["FeedbackRecords.count"],
          timeDimensions: [{ dimension: COLLECTED_AT, dateRange: ["2026-01-01", "2026-01-31"] }],
        },
        dateRange: { from: "2026-02-01", to: "2026-02-28" },
      });

      expect(sentQuery().timeDimensions).toEqual([
        { dimension: COLLECTED_AT, dateRange: ["2026-02-01", "2026-02-28"] },
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
      expect(problem.detail).toBe("The chart query is not valid");
      expect(problem.invalid_params).toContainEqual({
        name: "dateRange",
        reason: REQUESTED_DATE_RANGE_REASON,
      });
      expect(runChartQuery).not.toHaveBeenCalled();
    });

    test("refuses only the range when the query is valid, naming the part at fault", async () => {
      const response = await preview({ dateRange: { from: "2026-02-01", to: "2026-01-01" } });

      expect(response.status).toBe(422);
      const problem = await problemOf(response);
      expect(problem.detail).toBe("The date range is not valid");
      expect(problem.invalid_params).toEqual([{ name: "dateRange.from", reason: "Must not be after to." }]);
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
        query: hourlyOver(undefined),
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

  describe("runV3ChartQuery with dashboard picks (C6)", () => {
    const run = (extraFilters: unknown[]) =>
      runV3ChartQuery({
        access: access as never,
        datasetId,
        type: "bar",
        query: BY_SOURCE,
        dateRange: undefined,
        source: "v3.dashboards.chartData",
        extraFilters: extraFilters as never,
        context,
      });

    test("runs the picks through the validator: a field the dataset lacks answers 422 naming picks, not 502", async () => {
      const response = await run([
        { member: "FeedbackRecords.ed_plan_64879f7d", operator: "equals", values: ["Pro"] },
      ]);

      expect(response.status).toBe(422);
      const body = (await response.json()) as { invalid_params: { name: string }[] };
      expect(body.invalid_params[0].name).toMatch(/^picks/);
      expect(runChartQuery).not.toHaveBeenCalled();
    });

    test("loads the dataset's fields for the picks too, so a pick on a rarer embedded key is known", async () => {
      const pick = { member: "FeedbackRecords.ed_plan_64879f7d", operator: "equals", values: ["Pro"] };
      await run([pick]);

      expect(loadDatasetChartFields).toHaveBeenCalledWith(
        context.authentication,
        access,
        datasetId,
        expect.objectContaining({ filters: [pick] })
      );
    });

    test("runs valid picks ANDed onto the saved filters", async () => {
      const pick = { member: "FeedbackRecords.sourceName", operator: "equals", values: ["Web"] };
      const response = await run([pick]);

      expect(response.status).toBe(200);
      expect(runChartQuery).toHaveBeenCalledWith(
        expect.objectContaining({ query: expect.objectContaining({ filters: [pick] }) })
      );
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
      expect(loadAuthorizedChart).toHaveBeenCalledWith(chartId, "read", context, {
        datasetPermission: "read",
      });
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

    test("replaces the saved range with a requested pair, and keeps it for all-time on a chart grouped by time", async () => {
      vi.mocked(loadAuthorizedChart).mockResolvedValue({
        row: chartOf({
          ...RANGED,
          timeDimensions: [
            { dimension: COLLECTED_AT, granularity: "week", dateRange: ["2026-01-01", "2026-06-30"] },
          ],
        }),
        access,
      });

      await read({ from: "2025-12-01", to: "2026-01-31" });
      await read({ dateRange: "all-time" });

      expect(vi.mocked(runChartQuery).mock.calls.map(([run]) => run.query.timeDimensions)).toEqual([
        [{ dimension: COLLECTED_AT, granularity: "week", dateRange: ["2025-12-01", "2026-01-31"] }],
        [{ dimension: COLLECTED_AT, granularity: "week", dateRange: ["2026-01-01", "2026-06-30"] }],
      ]);
    });

    test("refuses a half-given pair, a preset mixed with a pair, or a bad date, naming the parameter", async () => {
      const invalidRanges: [Record<string, string>, string][] = [
        [{ from: "2026-01-01" }, "to"],
        [{ to: "2026-01-01" }, "from"],
        [{ from: "01/02/2026", to: "2026-01-03" }, "from"],
        [{ dateRange: "today", from: "2026-01-01", to: "2026-01-02" }, "dateRange"],
        [{ dateRange: "yesterday-ish" }, "dateRange"],
      ];
      for (const [query, name] of invalidRanges) {
        const response = await read(query);
        expect(response.status).toBe(422);
        const problem = await problemOf(response);
        expect(problem.detail).toBe("The date range is not valid");
        expect(problem.invalid_params?.map((param) => param.name)).toEqual([name]);
      }
      expect(runChartQuery).not.toHaveBeenCalled();
    });

    test("still reads a saved chart whose range is one Cube reads itself, as older charts were saved", async () => {
      vi.mocked(loadAuthorizedChart).mockResolvedValue({
        row: chartOf({
          ...RANGED,
          timeDimensions: [{ dimension: COLLECTED_AT, granularity: "week", dateRange: "last 3 months" }],
        }),
        access,
      });

      expect((await read()).status).toBe(200);
      expect(runChartQuery).toHaveBeenCalledTimes(1);
    });

    test("names a requested range too wide for the chart's granularity as dateRange", async () => {
      vi.mocked(loadAuthorizedChart).mockResolvedValue({ row: chartOf(hourlyOver(undefined)), access });

      const response = await read({ from: "2025-01-01", to: "2026-12-31" });

      expect(response.status).toBe(422);
      expect((await problemOf(response)).invalid_params).toEqual([
        expect.objectContaining({ name: "dateRange", code: "limit_exceeded" }),
      ]);
      expect(runChartQuery).not.toHaveBeenCalled();
    });

    test("lets a requested range narrow a saved one too wide for the limit, and names the saved one otherwise", async () => {
      vi.mocked(loadAuthorizedChart).mockResolvedValue({
        row: chartOf(hourlyOver(["2024-01-01", "2025-12-31"])),
        access,
      });

      expect((await read({ from: "2025-12-01", to: "2025-12-07" })).status).toBe(200);

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
