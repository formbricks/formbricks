import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { cubeFake, resetCubeFake } from "@/integration/cube-fake";
import {
  type TDashboardsFixture,
  apiKeyOf,
  outcomeOf,
  seedDashboardsFixture,
  sessionOf,
} from "@/integration/dashboards-fixture";
import { getV3ChartData, previewV3Chart } from "./data-operations";
import { ZV3ChartData } from "./resources";
import { type TV3ChartPreviewBody, ZV3ChartDataQuery, ZV3ChartPreviewBody } from "./schemas";

/**
 * ENG-6586 against real PostgreSQL and SpiceDB, with Cube faked at its client boundary: what reaches Cube
 * — the query, the actor, the source, the time zone — is asserted on what the real client sent.
 */

vi.mock("@cubejs-client/core", async (importOriginal) =>
  (await import("@/integration/cube-fake")).fakeCubeModule(await importOriginal())
);

const entitlement = vi.hoisted(() => ({ dashboards: true }));
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsDashboardsEnabled: vi.fn(async () => entitlement.dashboards),
}));

let fixture: TDashboardsFixture;

const preview = (
  authentication: ReturnType<typeof sessionOf>,
  overrides: Partial<TV3ChartPreviewBody> = {}
) =>
  previewV3Chart({
    body: ZV3ChartPreviewBody.parse({
      workspaceId: fixture.workspaceId,
      datasetId: fixture.datasetId,
      type: "bar",
      query: { measures: ["FeedbackRecords.count"], dimensions: ["FeedbackRecords.sourceName"] },
      ...overrides,
    }),
    authentication,
    requestId: "req",
    instance: "/api/v3/charts/preview",
  });

const problemOf = async (response: Response) =>
  (await response.json()) as { code: string; detail: string; invalid_params?: { name: string }[] };

beforeAll(async () => {
  fixture = await seedDashboardsFixture();
  await prisma.organization.update({
    where: { id: fixture.organizationId },
    data: { displayTimeZone: "Europe/Berlin" },
  });
}, 120_000);

beforeEach(() => {
  entitlement.dashboards = true;
  resetCubeFake();
  cubeFake.rows = [
    { "FeedbackRecords.sourceName": "Web", "FeedbackRecords.count": "3" },
    { "FeedbackRecords.sourceName": "Email", "FeedbackRecords.count": "1" },
  ];
});

afterEach(() => {
  resetCubeFake();
});

describe("POST /api/v3/charts/preview", () => {
  test("runs an unsaved chart for a reader of the dataset, attributed to the user, and saves nothing", async () => {
    const chartsBefore = await prisma.chart.count();
    const response = await preview(sessionOf(fixture.users.viewer));

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: unknown };
    expect(ZV3ChartData.parse(data)).toEqual({
      rows: [
        { "FeedbackRecords.sourceName": "Web", "FeedbackRecords.count": 3 },
        { "FeedbackRecords.sourceName": "Email", "FeedbackRecords.count": 1 },
      ],
      optionLabels: {},
      fieldLabels: {},
      query: { measures: ["FeedbackRecords.count"], dimensions: ["FeedbackRecords.sourceName"] },
    });

    expect(cubeFake.calls).toHaveLength(1);
    const [{ claims, query }] = cubeFake.calls;
    expect(claims).toMatchObject({
      userId: fixture.users.viewer,
      tenantId: fixture.datasetId,
      workspaceId: fixture.workspaceId,
      organizationId: fixture.organizationId,
      source: "v3.charts.preview",
    });
    expect(claims).not.toHaveProperty("apiKeyId");
    // The organization's display time zone, never one the caller chose.
    expect(query).toMatchObject({
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.sourceName"],
      timezone: "Europe/Berlin",
    });
    expect(await prisma.chart.count()).toBe(chartsBefore);
  });

  test("attributes an API key's query to the key, not to a user", async () => {
    expect((await preview(apiKeyOf(fixture, "readKey"))).status).toBe(200);

    expect(cubeFake.calls[0].claims).toMatchObject({ apiKeyId: fixture.apiKeys.readKey });
    expect(cubeFake.calls[0].claims).not.toHaveProperty("userId");
  });

  test("applies a requested date range to collectedAt, resolved in the organization's time zone", async () => {
    vi.useFakeTimers({ now: new Date("2026-03-10T23:30:00Z"), toFake: ["Date"] });
    try {
      const response = await preview(sessionOf(fixture.users.viewer), {
        query: {
          measures: ["FeedbackRecords.count"],
          timeDimensions: [
            { dimension: "FeedbackRecords.collectedAt", granularity: "day", dateRange: "last 90 days" },
          ],
        },
        dateRange: "last 7 days",
      });
      expect(response.status).toBe(200);
    } finally {
      vi.useRealTimers();
    }

    // 23:30 UTC on the 10th is already the 11th in Berlin, so the window ends on the 11th.
    expect(cubeFake.calls[0].query.timeDimensions).toEqual([
      {
        dimension: "FeedbackRecords.collectedAt",
        granularity: "day",
        dateRange: ["2026-03-05", "2026-03-11"],
      },
    ]);
  });

  test("refuses an invalid query and an invalid date range with 422 before reaching Cube", async () => {
    const response = await preview(sessionOf(fixture.users.viewer), {
      query: { measures: ["FeedbackRecords.tenantId"], timezone: "UTC", ungrouped: true },
      dateRange: "since the dawn of time",
    });

    expect(response.status).toBe(422);
    const problem = await problemOf(response);
    expect(problem.code).toBe("unprocessable_content");
    expect(problem.invalid_params?.map((param) => param.name).sort()).toEqual(
      ["dateRange", "query.measures[0]", "query.timezone", "query.ungrouped"].sort()
    );
    expect(cubeFake.calls).toHaveLength(0);
  });

  test("needs read access to the dataset from this workspace", async () => {
    for (const datasetId of [fixture.unassignedDatasetId, fixture.foreignDatasetId]) {
      expect(await outcomeOf(await preview(sessionOf(fixture.users.owner), { datasetId }))).toEqual({
        status: 403,
        code: "forbidden",
      });
    }
    expect(await outcomeOf(await preview(sessionOf(fixture.users.outsider)))).toEqual({
      status: 403,
      code: "forbidden",
    });
    expect(cubeFake.calls).toHaveLength(0);
  });

  test("answers a Cube failure with a generic 502 that never carries Cube's own error", async () => {
    cubeFake.failure = new Error('Error: column "secret_table.tenant" does not exist');

    const response = await preview(sessionOf(fixture.users.viewer));

    expect(response.status).toBe(502);
    const problem = await problemOf(response);
    expect(problem.code).toBe("bad_gateway");
    expect(JSON.stringify(problem)).not.toContain("secret_table");
  });
});

describe("GET /api/v3/charts/{chartId}/data", () => {
  const COLLECTED_AT = "FeedbackRecords.collectedAt";
  const charts: Record<"ranged" | "unranged" | "unassigned", string> = {
    ranged: "",
    unranged: "",
    unassigned: "",
  };

  const read = (
    authentication: ReturnType<typeof sessionOf>,
    chartId: string,
    query: Record<string, string> = {}
  ) =>
    getV3ChartData({
      chartId,
      query: ZV3ChartDataQuery.parse(query),
      authentication,
      requestId: "req",
      instance: "/api/v3/charts/data",
    });

  /** The time dimensions Cube received, at a fixed instant so presets resolve to known days. */
  const timeDimensionsSent = async (chartId: string, query: Record<string, string> = {}) => {
    vi.useFakeTimers({ now: new Date("2026-03-10T12:00:00Z"), toFake: ["Date"] });
    try {
      const response = await read(sessionOf(fixture.users.viewer), chartId, query);
      expect(response.status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
    return cubeFake.calls.at(-1)?.query.timeDimensions;
  };

  beforeAll(async () => {
    const create = (name: string, query: object, feedbackDirectoryId = fixture.datasetId) =>
      prisma.chart.create({
        data: { name, type: "bar", workspaceId: fixture.workspaceId, feedbackDirectoryId, query, config: {} },
      });

    charts.ranged = (
      await create("Ranged", {
        measures: ["FeedbackRecords.count"],
        timeDimensions: [{ dimension: COLLECTED_AT, granularity: "week", dateRange: "last 90 days" }],
      })
    ).id;
    charts.unranged = (await create("Unranged", { measures: ["FeedbackRecords.count"] })).id;
    charts.unassigned = (
      await create("Elsewhere", { measures: ["FeedbackRecords.count"] }, fixture.unassignedDatasetId)
    ).id;
  });

  test("without a range, runs the chart with its own saved range", async () => {
    expect(await timeDimensionsSent(charts.ranged)).toEqual([
      { dimension: COLLECTED_AT, granularity: "week", dateRange: ["2025-12-11", "2026-03-10"] },
    ]);
  });

  test("a requested preset replaces the saved range on collectedAt, keeping the granularity", async () => {
    expect(await timeDimensionsSent(charts.ranged, { dateRange: "last 7 days" })).toEqual([
      { dimension: COLLECTED_AT, granularity: "week", dateRange: ["2026-03-04", "2026-03-10"] },
    ]);
  });

  test("a requested pair of dates is added as a filter-only collectedAt range when the chart has none", async () => {
    expect(await timeDimensionsSent(charts.unranged, { from: "2026-01-01", to: "2026-01-31" })).toEqual([
      { dimension: COLLECTED_AT, dateRange: ["2026-01-01", "2026-01-31"] },
    ]);
  });

  test("all-time removes the saved range", async () => {
    expect(await timeDimensionsSent(charts.ranged, { dateRange: "all-time" })).toEqual([
      { dimension: COLLECTED_AT, granularity: "week" },
    ]);
  });

  test("refuses an invalid or half-given range with 422 and a timezone with 400, before reaching Cube", async () => {
    const invalidRanges: Record<string, string>[] = [
      { dateRange: "yesterday-ish" },
      { from: "2026-01-01" },
      { dateRange: "today", from: "2026-01-01", to: "2026-01-02" },
    ];
    for (const query of invalidRanges) {
      expect(await outcomeOf(await read(sessionOf(fixture.users.viewer), charts.ranged, query))).toEqual({
        status: 422,
        code: "unprocessable_content",
      });
    }
    expect(ZV3ChartDataQuery.safeParse({ timezone: "UTC" }).success).toBe(false);
    expect(cubeFake.calls).toHaveLength(0);
  });

  test("attributes the read to the API key and labels it as a v3 data read", async () => {
    expect((await read(apiKeyOf(fixture, "readKey"), charts.unranged)).status).toBe(200);
    expect(cubeFake.calls[0].claims).toMatchObject({
      apiKeyId: fixture.apiKeys.readKey,
      source: "v3.charts.data",
    });
  });

  test("needs read access to the chart's dataset as well as its workspace", async () => {
    expect(await outcomeOf(await read(sessionOf(fixture.users.owner), charts.unassigned))).toEqual({
      status: 403,
      code: "forbidden",
    });
    expect(await outcomeOf(await read(sessionOf(fixture.users.outsider), charts.unranged))).toEqual({
      status: 403,
      code: "forbidden",
    });
    expect(cubeFake.calls).toHaveLength(0);
  });
});
