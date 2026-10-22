import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  type TDashboardsFixture,
  apiKeyOf,
  outcomeOf,
  seedDashboardsFixture,
  sessionOf,
} from "@/integration/dashboards-fixture";
import { getV3Chart, listV3Charts } from "./operations";
import { type TV3ChartResource, ZV3ChartResource } from "./resources";
import { ZV3ChartListQuery } from "./schemas";

/**
 * Chart operations against real PostgreSQL and SpiceDB, called the way the route and the MCP tools call
 * them. ENG-6585: listing and reading.
 */

const entitlement = vi.hoisted(() => ({ dashboards: true }));
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsDashboardsEnabled: vi.fn(async () => entitlement.dashboards),
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
