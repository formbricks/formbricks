import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  type TDashboardsFixture,
  outcomeOf,
  seedDashboardsFixture,
  sessionOf,
} from "@/integration/dashboards-fixture";
import { replaceV3Dashboard, updateV3DashboardLayout } from "./operations";
import type { TV3DashboardResource } from "./resources";

/**
 * Whole-dashboard writes against real PostgreSQL and SpiceDB (ENG-6594): the app's save, which replaces
 * the name and every widget's place at once, and the agent rearrange, which must list every widget.
 */

vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsDashboardsEnabled: vi.fn(async () => true),
}));

let fixture: TDashboardsFixture;
let dashboardId = "";
const widgets = { a: "", b: "", c: "" };
const charts: string[] = [];

const context = () => ({
  authentication: sessionOf(fixture.users.editor),
  requestId: "req",
  instance: "/api/v3/dashboards",
});

const bodyOf = async <T>(response: Response) => (await response.json()) as T;

const snapshot = () =>
  prisma.dashboard.findUniqueOrThrow({
    where: { id: dashboardId },
    select: {
      name: true,
      updatedAt: true,
      widgets: { orderBy: { order: "asc" }, select: { id: true, layout: true, order: true } },
    },
  });

beforeAll(async () => {
  fixture = await seedDashboardsFixture();
  for (const name of ["A", "B", "C"]) {
    charts.push(
      (
        await prisma.chart.create({
          data: {
            name,
            type: "bar",
            workspaceId: fixture.workspaceId,
            feedbackDirectoryId: fixture.datasetId,
            query: { measures: ["FeedbackRecords.count"] },
            config: {},
          },
        })
      ).id
    );
  }
}, 120_000);

beforeEach(async () => {
  await prisma.dashboard.deleteMany({ where: { workspaceId: fixture.workspaceId } });
  const dashboard = await prisma.dashboard.create({
    data: {
      name: "Board",
      workspaceId: fixture.workspaceId,
      widgets: {
        create: [
          { chartId: charts[0], layout: { x: 0, y: 0, w: 4, h: 4 }, order: 0 },
          { chartId: charts[1], layout: { x: 4, y: 0, w: 4, h: 4 }, order: 1 },
          { chartId: charts[2], layout: { x: 8, y: 0, w: 4, h: 4 }, order: 2 },
        ],
      },
    },
    select: { id: true, widgets: { orderBy: { order: "asc" }, select: { id: true } } },
  });
  dashboardId = dashboard.id;
  [widgets.a, widgets.b, widgets.c] = dashboard.widgets.map((widget) => widget.id);
});

const currentUpdatedAt = async () => (await snapshot()).updatedAt.toISOString();

describe("PUT /api/v3/dashboards/{dashboardId}", () => {
  test("replaces the name and every place at once, and removes a widget left out", async () => {
    const response = await replaceV3Dashboard({
      dashboardId,
      body: {
        name: "Board v2",
        expectedUpdatedAt: await currentUpdatedAt(),
        widgets: [
          { widgetId: widgets.c, layout: { x: 0, y: 0, w: 12, h: 4 }, order: 0 },
          { widgetId: widgets.a, layout: { x: 0, y: 4, w: 6, h: 4 }, order: 1 },
        ],
      },
      auditLog: {} as never,
      ...context(),
    });
    expect(response.status).toBe(200);

    const { data } = await bodyOf<{ data: TV3DashboardResource }>(response);
    expect(data.name).toBe("Board v2");
    expect(data.widgets.map(({ id, layout, order }) => ({ id, layout, order }))).toEqual([
      { id: widgets.c, layout: { x: 0, y: 0, w: 12, h: 4 }, order: 0 },
      { id: widgets.a, layout: { x: 0, y: 4, w: 6, h: 4 }, order: 1 },
    ]);
    // The left-out widget is gone; its chart is not.
    expect(await prisma.dashboardWidget.findUnique({ where: { id: widgets.b } })).toBeNull();
    expect(await prisma.chart.count({ where: { id: { in: charts } } })).toBe(3);
  });

  test("refuses a stale updatedAt with 409 naming the current one, and changes nothing", async () => {
    const before = await snapshot();
    const stale = new Date(before.updatedAt.getTime() - 60_000).toISOString();

    const response = await replaceV3Dashboard({
      dashboardId,
      body: { name: "Overwritten", expectedUpdatedAt: stale, widgets: [] },
      ...context(),
    });
    expect(response.status).toBe(409);
    expect(await bodyOf<{ details: unknown }>(response)).toMatchObject({
      code: "conflict",
      details: { expectedUpdatedAt: stale, currentUpdatedAt: before.updatedAt.toISOString() },
    });
    expect(await snapshot()).toEqual(before);
  });

  test("refuses overlapping widgets and a name already taken without saving any of the change", async () => {
    await prisma.dashboard.create({ data: { name: "Taken", workspaceId: fixture.workspaceId } });
    const before = await snapshot();
    const keepAll = [
      { widgetId: widgets.a, layout: { x: 0, y: 4, w: 4, h: 4 }, order: 0 },
      { widgetId: widgets.b, layout: { x: 4, y: 0, w: 4, h: 4 }, order: 1 },
      { widgetId: widgets.c, layout: { x: 8, y: 0, w: 4, h: 4 }, order: 2 },
    ];

    const overlapping = await replaceV3Dashboard({
      dashboardId,
      body: {
        name: "Board",
        expectedUpdatedAt: before.updatedAt.toISOString(),
        widgets: [...keepAll.slice(0, 2), { ...keepAll[2], layout: { x: 6, y: 0, w: 4, h: 4 } }],
      },
      ...context(),
    });
    expect(await outcomeOf(overlapping)).toEqual({ status: 422, code: "unprocessable_content" });

    const nameTaken = await replaceV3Dashboard({
      dashboardId,
      body: { name: "Taken", expectedUpdatedAt: before.updatedAt.toISOString(), widgets: keepAll },
      ...context(),
    });
    expect(await outcomeOf(nameTaken)).toEqual({ status: 409, code: "conflict" });

    expect(await snapshot()).toEqual(before);
  });

  test("refuses a widget that is not on the dashboard", async () => {
    const other = await prisma.dashboard.create({
      data: {
        name: "Other",
        workspaceId: fixture.workspaceId,
        widgets: { create: [{ chartId: charts[0], layout: { x: 0, y: 0, w: 4, h: 4 }, order: 0 }] },
      },
      select: { widgets: { select: { id: true } } },
    });

    const response = await replaceV3Dashboard({
      dashboardId,
      body: {
        name: "Board",
        expectedUpdatedAt: await currentUpdatedAt(),
        widgets: [{ widgetId: other.widgets[0].id, layout: { x: 0, y: 8, w: 4, h: 4 }, order: 0 }],
      },
      ...context(),
    });
    expect(await outcomeOf(response)).toEqual({ status: 422, code: "unprocessable_content" });
    expect(await prisma.dashboardWidget.count({ where: { dashboardId } })).toBe(3);
  });
});

describe("update_dashboard_layout (MCP rearrange)", () => {
  test("refuses a list that leaves a widget out, and removes nothing", async () => {
    const before = await snapshot();
    const response = await updateV3DashboardLayout({
      dashboardId,
      body: {
        expectedUpdatedAt: before.updatedAt.toISOString(),
        widgets: [
          { widgetId: widgets.a, layout: { x: 0, y: 0, w: 6, h: 4 } },
          { widgetId: widgets.b, layout: { x: 6, y: 0, w: 6, h: 4 } },
        ],
      },
      ...context(),
    });

    expect(response.status).toBe(422);
    const problem = await bodyOf<{ invalid_params: { reason: string }[] }>(response);
    expect(problem.invalid_params[0].reason).toContain(widgets.c);
    expect(await snapshot()).toEqual(before);
  });

  test("moves every widget, keeping the name and the order", async () => {
    const response = await updateV3DashboardLayout({
      dashboardId,
      body: {
        expectedUpdatedAt: await currentUpdatedAt(),
        widgets: [
          { widgetId: widgets.c, layout: { x: 0, y: 8, w: 12, h: 4 } },
          { widgetId: widgets.a, layout: { x: 0, y: 0, w: 6, h: 4 } },
          { widgetId: widgets.b, layout: { x: 6, y: 0, w: 6, h: 4 } },
        ],
      },
      auditLog: {} as never,
      ...context(),
    });
    expect(response.status).toBe(200);

    const after = await snapshot();
    expect(after.name).toBe("Board");
    expect(after.widgets.map(({ id, layout, order }) => ({ id, layout, order }))).toEqual([
      { id: widgets.a, layout: { x: 0, y: 0, w: 6, h: 4 }, order: 0 },
      { id: widgets.b, layout: { x: 6, y: 0, w: 6, h: 4 }, order: 1 },
      { id: widgets.c, layout: { x: 0, y: 8, w: 12, h: 4 }, order: 2 },
    ]);
  });
});

describe("a dashboard that grew past the widget cap before it existed", () => {
  test("saves whole, moving every widget in one write, and can shrink", async () => {
    const count = 300;
    const chartIds = await prisma.chart.createManyAndReturn({
      data: Array.from({ length: count }, (_, index) => ({
        name: `Pre-cap ${index}`,
        type: "big_number" as const,
        workspaceId: fixture.workspaceId,
        feedbackDirectoryId: fixture.datasetId,
        query: { measures: ["FeedbackRecords.count"] },
        config: {},
      })),
      select: { id: true },
    });
    const board = await prisma.dashboard.create({
      data: {
        name: "Pre-cap board",
        workspaceId: fixture.workspaceId,
        widgets: {
          create: chartIds.map(({ id }, index) => ({
            chartId: id,
            layout: { x: (index % 4) * 3, y: Math.floor(index / 4) * 2, w: 3, h: 2 },
            order: index,
          })),
        },
      },
      include: { widgets: { orderBy: { order: "asc" }, select: { id: true } } },
    });

    // Reverse the order and move every widget one row down, keeping all but the last.
    const kept = board.widgets.slice(0, count - 1);
    const response = await replaceV3Dashboard({
      dashboardId: board.id,
      body: {
        name: "Pre-cap board, saved",
        expectedUpdatedAt: board.updatedAt.toISOString(),
        widgets: kept.map(({ id }, index) => ({
          widgetId: id,
          layout: { x: (index % 4) * 3, y: Math.floor(index / 4) * 2 + 1, w: 3, h: 2 },
          order: count - index,
        })),
      },
      auditLog: {} as never,
      ...context(),
    });

    expect(response.status).toBe(200);
    const stored = await prisma.dashboardWidget.findMany({
      where: { dashboardId: board.id },
      select: { id: true, layout: true, order: true },
    });
    expect(stored).toHaveLength(count - 1);
    const byId = new Map(stored.map((widget) => [widget.id, widget]));
    expect(byId.get(kept[0].id)).toMatchObject({ order: count, layout: { x: 0, y: 1, w: 3, h: 2 } });
    expect(byId.get(kept[count - 2].id)).toMatchObject({ order: 2 });

    await prisma.dashboard.delete({ where: { id: board.id } });
    await prisma.chart.deleteMany({ where: { id: { in: chartIds.map(({ id }) => id) } } });
  });
});
