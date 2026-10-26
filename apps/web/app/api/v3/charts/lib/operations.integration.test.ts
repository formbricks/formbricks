import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  type TDashboardsFixture,
  apiKeyOf,
  outcomeOf,
  seedDashboardsFixture,
  sessionOf,
} from "@/integration/dashboards-fixture";
import { createV3Chart, getV3Chart, listV3Charts, updateV3Chart } from "./operations";
import { type TV3ChartResource, ZV3ChartResource } from "./resources";
import { ZV3ChartCreateBody, ZV3ChartListQuery, ZV3ChartUpdateBody } from "./schemas";

/**
 * Chart operations against real PostgreSQL and SpiceDB, called the way the route and the MCP tools call
 * them. ENG-6585: listing and reading.
 */

const entitlement = vi.hoisted(() => ({ dashboards: true }));
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsDashboardsEnabled: vi.fn(async () => entitlement.dashboards),
}));

const upgrade = vi.hoisted(() => ({ finished: true }));
vi.mock("@/lib/upgrade/compatibility", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/upgrade/compatibility")>()),
  isNewReleaseWorkEnabled: vi.fn(async () => upgrade.finished),
}));

let fixture: TDashboardsFixture;
const charts: Record<"older" | "newer" | "other", string> = { older: "", newer: "", other: "" };
let dashboardIds: { alpha: string; beta: string };

const context = (authentication: ReturnType<typeof sessionOf>) => ({
  authentication,
  requestId: "req",
  instance: "/api/v3/charts",
});

const list = (authentication: ReturnType<typeof sessionOf>, query: Record<string, unknown> = {}) =>
  listV3Charts({
    query: ZV3ChartListQuery.parse({ workspaceId: fixture.workspaceId, ...query }),
    ...context(authentication),
  });

const bodyOf = async <T>(response: Response) => (await response.json()) as T;

beforeAll(async () => {
  fixture = await seedDashboardsFixture();

  const createChart = (name: string, createdAt: Date, extra: { feedbackDirectoryId?: string } = {}) =>
    prisma.chart.create({
      data: {
        name,
        type: "bar",
        workspaceId: fixture.workspaceId,
        feedbackDirectoryId: extra.feedbackDirectoryId ?? fixture.datasetId,
        query: { measures: ["FeedbackRecords.count"] },
        config: { showLegend: true },
        createdBy: fixture.users.editor,
        createdAt,
      },
    });

  charts.older = (await createChart("NPS by month", new Date("2026-01-01T00:00:00Z"))).id;
  charts.newer = (await createChart("Sentiment split", new Date("2026-02-01T00:00:00Z"))).id;
  charts.other = (
    await createChart("50% done", new Date("2026-03-01T00:00:00Z"), {
      feedbackDirectoryId: fixture.unassignedDatasetId,
    })
  ).id;

  const alpha = await prisma.dashboard.create({ data: { name: "Alpha", workspaceId: fixture.workspaceId } });
  const beta = await prisma.dashboard.create({ data: { name: "Beta", workspaceId: fixture.workspaceId } });
  dashboardIds = { alpha: alpha.id, beta: beta.id };
  await prisma.dashboardWidget.createMany({
    data: [
      { dashboardId: beta.id, chartId: charts.older, layout: { x: 0, y: 0, w: 4, h: 4 }, order: 0 },
      { dashboardId: alpha.id, chartId: charts.older, layout: { x: 0, y: 0, w: 4, h: 4 }, order: 0 },
    ],
  });
}, 120_000);

beforeEach(() => {
  entitlement.dashboards = true;
  upgrade.finished = true;
});

describe("GET /api/v3/charts", () => {
  test("lists the workspace's charts newest first, each with the dashboards that hold it", async () => {
    const response = await list(sessionOf(fixture.users.viewer));
    expect(response.status).toBe(200);

    const body = await bodyOf<{
      data: TV3ChartResource[];
      meta: { limit: number; nextCursor: string | null };
    }>(response);
    expect(body.data.map((chart) => chart.id)).toEqual([charts.other, charts.newer, charts.older]);
    expect(body.meta).toEqual({ limit: 50, nextCursor: null });
    for (const chart of body.data) ZV3ChartResource.parse(chart);

    expect(body.data.find((chart) => chart.id === charts.older)).toMatchObject({
      workspaceId: fixture.workspaceId,
      datasetId: fixture.datasetId,
      creator: { name: "editor" },
      // Ordered by name, and served by the chart read itself.
      dashboards: [
        { id: dashboardIds.alpha, name: "Alpha" },
        { id: dashboardIds.beta, name: "Beta" },
      ],
    });
    expect(body.data.find((chart) => chart.id === charts.newer)?.dashboards).toEqual([]);
  });

  test("pages with a cursor until nextCursor is null, never repeating or skipping a chart", async () => {
    const seen: string[] = [];
    let cursor: string | undefined;

    do {
      const body = await bodyOf<{ data: TV3ChartResource[]; meta: { nextCursor: string | null } }>(
        await list(sessionOf(fixture.users.viewer), { limit: "1", ...(cursor ? { cursor } : {}) })
      );
      expect(body.data).toHaveLength(1);
      seen.push(body.data[0].id);
      cursor = body.meta.nextCursor ?? undefined;
    } while (cursor);

    expect(seen).toEqual([charts.other, charts.newer, charts.older]);
  });

  test("filters by name, ignoring case and treating LIKE wildcards literally, and by dataset", async () => {
    const byName = await bodyOf<{ data: TV3ChartResource[] }>(
      await list(sessionOf(fixture.users.viewer), { "filter[name][contains]": "nps" })
    );
    expect(byName.data.map((chart) => chart.id)).toEqual([charts.older]);

    const wildcard = await bodyOf<{ data: TV3ChartResource[] }>(
      await list(sessionOf(fixture.users.viewer), { "filter[name][contains]": "%" })
    );
    expect(wildcard.data.map((chart) => chart.id)).toEqual([charts.other]);

    const byDataset = await bodyOf<{ data: TV3ChartResource[] }>(
      await list(sessionOf(fixture.users.viewer), { "filter[datasetId][eq]": fixture.unassignedDatasetId })
    );
    expect(byDataset.data.map((chart) => chart.id)).toEqual([charts.other]);
  });

  test("refuses a cursor minted for another filter set", async () => {
    const first = await bodyOf<{ meta: { nextCursor: string } }>(
      await list(sessionOf(fixture.users.viewer), { limit: "1" })
    );

    const response = await list(sessionOf(fixture.users.viewer), {
      limit: "1",
      cursor: first.meta.nextCursor,
      "filter[name][contains]": "s",
    });
    expect(await outcomeOf(response)).toEqual({ status: 400, code: "bad_request" });
  });

  test("lets every role and API-key permission that can read the workspace list, and no one else", async () => {
    for (const authentication of [
      sessionOf(fixture.users.owner),
      sessionOf(fixture.users.editor),
      sessionOf(fixture.users.viewer),
      apiKeyOf(fixture, "readKey"),
      apiKeyOf(fixture, "writeKey"),
      apiKeyOf(fixture, "manageKey"),
    ]) {
      expect((await list(authentication)).status).toBe(200);
    }

    expect(await outcomeOf(await list(sessionOf(fixture.users.outsider)))).toEqual({
      status: 403,
      code: "forbidden",
    });
    expect(
      await outcomeOf(
        await listV3Charts({
          query: ZV3ChartListQuery.parse({ workspaceId: fixture.foreignWorkspaceId }),
          ...context(sessionOf(fixture.users.owner)),
        })
      )
    ).toEqual({ status: 403, code: "forbidden" });
  });

  test("answers dashboards_plan_required to an authorized caller without the entitlement", async () => {
    entitlement.dashboards = false;
    expect(await outcomeOf(await list(apiKeyOf(fixture, "readKey")))).toEqual({
      status: 403,
      code: "dashboards_plan_required",
    });
  });
});

describe("GET /api/v3/charts/{chartId}", () => {
  test("returns the chart with its embedded dashboards", async () => {
    const response = await getV3Chart({ chartId: charts.older, ...context(apiKeyOf(fixture, "readKey")) });
    expect(response.status).toBe(200);

    const { data } = await bodyOf<{ data: TV3ChartResource }>(response);
    expect(ZV3ChartResource.parse(data)).toMatchObject({
      id: charts.older,
      name: "NPS by month",
      type: "bar",
      query: { measures: ["FeedbackRecords.count"] },
      config: { showLegend: true },
      dashboards: [
        { id: dashboardIds.alpha, name: "Alpha" },
        { id: dashboardIds.beta, name: "Beta" },
      ],
    });
  });

  test("answers 403 for a chart the caller cannot see and for one that does not exist", async () => {
    expect(
      await outcomeOf(
        await getV3Chart({ chartId: charts.older, ...context(sessionOf(fixture.users.outsider)) })
      )
    ).toEqual({ status: 403, code: "forbidden" });
    expect(
      await outcomeOf(
        await getV3Chart({ chartId: "clzzzzzzzzzzzzzzzzzzzzzzz", ...context(sessionOf(fixture.users.owner)) })
      )
    ).toEqual({ status: 403, code: "forbidden" });
  });
});

const auditLog = () => ({}) as Record<string, unknown>;

describe("POST /api/v3/charts", () => {
  const create = (
    authentication: ReturnType<typeof sessionOf>,
    overrides: Record<string, unknown> = {},
    log: Record<string, unknown> = auditLog()
  ) =>
    createV3Chart({
      body: ZV3ChartCreateBody.parse({
        workspaceId: fixture.workspaceId,
        datasetId: fixture.datasetId,
        name: `Chart ${crypto.randomUUID()}`,
        type: "bar",
        query: { measures: ["FeedbackRecords.count"], dimensions: ["FeedbackRecords.sourceName"] },
        ...overrides,
      }),
      auditLog: log as never,
      ...context(authentication),
    });

  test("creates a chart with 201 and Location, stored as validated, and fills the audit entry", async () => {
    const log = auditLog();
    const response = await create(
      sessionOf(fixture.users.editor),
      {
        name: "Weekly NPS",
        config: { showLegend: false },
        query: {
          measures: ["FeedbackRecords.npsScore"],
          timeDimensions: [
            { dimension: "FeedbackRecords.collectedAt", granularity: "week", dateRange: "all-time" },
          ],
        },
      },
      log
    );

    expect(response.status).toBe(201);
    const { data } = await bodyOf<{ data: TV3ChartResource }>(response);
    expect(response.headers.get("Location")).toBe(`/api/v3/charts/${data.id}`);
    expect(ZV3ChartResource.parse(data)).toMatchObject({
      name: "Weekly NPS",
      datasetId: fixture.datasetId,
      config: { showLegend: false },
      dashboards: [],
      creator: { name: "editor" },
      // `all-time` is no range at all, which is how it is stored.
      query: {
        measures: ["FeedbackRecords.npsScore"],
        timeDimensions: [{ dimension: "FeedbackRecords.collectedAt", granularity: "week" }],
      },
    });
    expect(log).toMatchObject({ targetId: data.id, organizationId: fixture.organizationId, newObject: data });
  });

  test("needs write access to the workspace and to the dataset", async () => {
    expect((await create(apiKeyOf(fixture, "writeKey"))).status).toBe(201);
    expect((await create(apiKeyOf(fixture, "manageKey"))).status).toBe(201);

    for (const authentication of [sessionOf(fixture.users.viewer), apiKeyOf(fixture, "readKey")]) {
      expect(await outcomeOf(await create(authentication))).toEqual({ status: 403, code: "forbidden" });
    }
    expect(
      await outcomeOf(
        await create(sessionOf(fixture.users.owner), { datasetId: fixture.unassignedDatasetId })
      )
    ).toEqual({ status: 403, code: "forbidden" });
  });

  test("answers 409 for a name already used in the workspace", async () => {
    expect((await create(sessionOf(fixture.users.editor), { name: "Taken" })).status).toBe(201);
    expect(await outcomeOf(await create(sessionOf(fixture.users.editor), { name: "Taken" }))).toEqual({
      status: 409,
      code: "conflict",
    });
  });

  test("runs the chart query validator and stores nothing it refuses", async () => {
    const before = await prisma.chart.count();
    const response = await create(sessionOf(fixture.users.editor), {
      query: { measures: ["FeedbackRecords.tenantId"], segments: ["x"] },
    });

    expect(response.status).toBe(422);
    expect(await prisma.chart.count()).toBe(before);
  });

  test("refuses a matrix chart while the online upgrade is unfinished, and allows it afterwards", async () => {
    const matrix = {
      type: "matrix",
      query: {
        measures: ["FeedbackRecords.count"],
        dimensions: ["FeedbackRecords.fieldId", "FeedbackRecords.valueId"],
      },
    };

    upgrade.finished = false;
    expect(await outcomeOf(await create(sessionOf(fixture.users.editor), matrix))).toEqual({
      status: 422,
      code: "unprocessable_content",
    });

    upgrade.finished = true;
    expect((await create(sessionOf(fixture.users.editor), matrix)).status).toBe(201);
  });
});

describe("PATCH /api/v3/charts/{chartId}", () => {
  const update = (
    authentication: ReturnType<typeof sessionOf>,
    chartId: string,
    body: Record<string, unknown>,
    log: Record<string, unknown> = auditLog()
  ) =>
    updateV3Chart({
      chartId,
      body: ZV3ChartUpdateBody.parse(body),
      auditLog: log as never,
      ...context(authentication),
    });

  test("edits name, type, query and display settings, and audits old and new", async () => {
    const created = await prisma.chart.create({
      data: {
        name: "Before",
        type: "bar",
        workspaceId: fixture.workspaceId,
        feedbackDirectoryId: fixture.datasetId,
        query: { measures: ["FeedbackRecords.count"] },
        config: {},
      },
    });
    const log = auditLog();

    const response = await update(
      sessionOf(fixture.users.editor),
      created.id,
      {
        name: "After",
        type: "pie",
        query: { measures: ["FeedbackRecords.count"], dimensions: ["FeedbackRecords.sentiment"] },
        config: { pieDisplay: "breakdown" },
      },
      log
    );

    expect(response.status).toBe(200);
    const { data } = await bodyOf<{ data: TV3ChartResource }>(response);
    expect(data).toMatchObject({
      name: "After",
      type: "pie",
      config: { pieDisplay: "breakdown" },
      query: { dimensions: ["FeedbackRecords.sentiment"] },
    });
    expect(log).toMatchObject({
      targetId: created.id,
      oldObject: expect.objectContaining({ name: "Before" }),
      newObject: expect.objectContaining({ name: "After" }),
    });
  });

  test("needs write access to the chart's workspace; reading it is not enough", async () => {
    for (const authentication of [sessionOf(fixture.users.viewer), apiKeyOf(fixture, "readKey")]) {
      expect(await outcomeOf(await update(authentication, charts.newer, { name: "Nope" }))).toEqual({
        status: 403,
        code: "forbidden",
      });
    }
    expect((await prisma.chart.findUniqueOrThrow({ where: { id: charts.newer } })).name).toBe(
      "Sentiment split"
    );
  });

  test("needs write access to the chart's Feedback Dataset too, even for the organization owner", async () => {
    expect(
      await outcomeOf(
        await update(sessionOf(fixture.users.owner), charts.other, {
          query: { measures: ["FeedbackRecords.count"], dimensions: ["FeedbackRecords.sentiment"] },
        })
      )
    ).toEqual({ status: 403, code: "forbidden" });
    expect((await prisma.chart.findUniqueOrThrow({ where: { id: charts.other } })).query).toEqual({
      measures: ["FeedbackRecords.count"],
    });
  });

  test("answers 409 for a taken name and 422 for an invalid query", async () => {
    expect(
      await outcomeOf(await update(sessionOf(fixture.users.editor), charts.newer, { name: "NPS by month" }))
    ).toEqual({
      status: 409,
      code: "conflict",
    });
    expect(
      (
        await update(sessionOf(fixture.users.editor), charts.newer, {
          query: { measures: ["FeedbackRecords.nope"] },
        })
      ).status
    ).toBe(422);
  });

  test("refuses a datasetId in the body: a chart's Feedback Dataset is fixed", () => {
    const parsed = ZV3ChartUpdateBody.safeParse({ name: "x", datasetId: fixture.unassignedDatasetId });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]).toMatchObject({
      path: ["datasetId"],
      params: { code: "read_only_field" },
    });
  });
});
