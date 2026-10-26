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
