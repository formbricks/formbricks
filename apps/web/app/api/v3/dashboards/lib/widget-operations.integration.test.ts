import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  type TDashboardsFixture,
  apiKeyOf,
  outcomeOf,
  seedDashboardsFixture,
  sessionOf,
} from "@/integration/dashboards-fixture";
import type { TV3DashboardWidget } from "./resources";
import { ZV3WidgetLayoutInput } from "./schemas";
import { addV3DashboardWidget, removeV3DashboardWidget, updateV3DashboardWidget } from "./widget-operations";

/**
 * Widget operations against real PostgreSQL and SpiceDB (ENG-6593): placement, the no-overlap and
 * chart-at-most-once rules, and the `updatedAt` every widget write moves.
 */

vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsDashboardsEnabled: vi.fn(async () => true),
}));

let fixture: TDashboardsFixture;
const charts = { bar: "", bigNumber: "", spare: "", foreign: "" };
let dashboardId = "";
let firstWidgetId = "";

const STALE = new Date("2026-01-01T00:00:00Z");

const context = (authentication: ReturnType<typeof sessionOf>) => ({
  authentication,
  requestId: "req",
  instance: "/api/v3/dashboards/widgets",
});

const bodyOf = async <T>(response: Response) => (await response.json()) as T;

const editor = () => sessionOf(fixture.users.editor);

const add = (chartId: string, layout?: { x: number; y: number; w: number; h: number }) =>
  addV3DashboardWidget({
    dashboardId,
    body: { chartId, ...(layout ? { layout } : {}) },
    auditLog: {} as never,
    ...context(editor()),
  });

const markStale = () => prisma.dashboard.update({ where: { id: dashboardId }, data: { updatedAt: STALE } });

const updatedAt = async () =>
  (await prisma.dashboard.findUniqueOrThrow({ where: { id: dashboardId } })).updatedAt.getTime();

beforeAll(async () => {
  fixture = await seedDashboardsFixture();

  const chart = (name: string, type: "bar" | "big_number", workspaceId = fixture.workspaceId) =>
    prisma.chart.create({
      data: {
        name,
        type,
        workspaceId,
        feedbackDirectoryId:
          workspaceId === fixture.workspaceId ? fixture.datasetId : fixture.foreignDatasetId,
        query: { measures: ["FeedbackRecords.count"] },
        config: {},
      },
    });
  charts.bar = (await chart("Bar", "bar")).id;
  charts.bigNumber = (await chart("Big number", "big_number")).id;
  charts.spare = (await chart("Spare", "bar")).id;
  charts.foreign = (await chart("Foreign", "bar", fixture.foreignWorkspaceId)).id;

  dashboardId = (
    await prisma.dashboard.create({ data: { name: "Widgets", workspaceId: fixture.workspaceId } })
  ).id;
}, 120_000);

beforeEach(async () => {
  await markStale();
});

describe("POST /api/v3/dashboards/{dashboardId}/widgets", () => {
  test("places a chart without a layout in the first open slot at its type's default size", async () => {
    const first = await add(charts.bar);
    expect(first.status).toBe(201);
    const widget = (await bodyOf<{ data: TV3DashboardWidget }>(first)).data;
    firstWidgetId = widget.id;
    expect(first.headers.get("Location")).toBe(`/api/v3/dashboards/${dashboardId}/widgets/${widget.id}`);
    expect(widget).toMatchObject({ chartId: charts.bar, layout: { x: 0, y: 0, w: 4, h: 4 }, order: 0 });
    expect(widget.chart.id).toBe(charts.bar);
    expect(await updatedAt()).toBeGreaterThan(STALE.getTime());

    // Beside the bar chart, not below it, at the big number's own size.
    const second = (await bodyOf<{ data: TV3DashboardWidget }>(await add(charts.bigNumber))).data;
    expect(second).toMatchObject({ layout: { x: 4, y: 0, w: 3, h: 2 }, order: 1 });
  });

  test("answers 409 for a chart already on the dashboard, and changes nothing", async () => {
    expect(await outcomeOf(await add(charts.bar))).toEqual({ status: 409, code: "conflict" });
    expect(await prisma.dashboardWidget.count({ where: { dashboardId } })).toBe(2);
    expect(await updatedAt()).toBe(STALE.getTime());
  });

  test("puts a chart exactly where asked, gaps allowed, and refuses an overlap naming the widget", async () => {
    const overlapping = await add(charts.spare, { x: 2, y: 2, w: 4, h: 4 });
    expect(overlapping.status).toBe(422);
    const problem = await bodyOf<{ invalid_params: { name: string; reason: string }[] }>(overlapping);
    expect(problem.invalid_params).toEqual([
      { name: "layout", reason: expect.stringContaining(firstWidgetId) },
    ]);
    expect(await updatedAt()).toBe(STALE.getTime());

    const placed = (
      await bodyOf<{ data: TV3DashboardWidget }>(await add(charts.spare, { x: 8, y: 10, w: 4, h: 3 }))
    ).data;
    expect(placed.layout).toEqual({ x: 8, y: 10, w: 4, h: 3 });
    await prisma.dashboardWidget.delete({ where: { id: placed.id } });
  });

  test("refuses a chart from another workspace, a viewer, and a read-only key with 403", async () => {
    expect(await outcomeOf(await add(charts.foreign))).toEqual({ status: 403, code: "forbidden" });
    for (const authentication of [sessionOf(fixture.users.viewer), apiKeyOf(fixture, "readKey")]) {
      expect(
        await outcomeOf(
          await addV3DashboardWidget({
            dashboardId,
            body: { chartId: charts.spare },
            ...context(authentication),
          })
        )
      ).toEqual({ status: 403, code: "forbidden" });
    }
  });
});

describe("concurrent widget writes", () => {
  test("adding many charts to one dashboard at once places every one, without overlaps", async () => {
    const board = await prisma.dashboard.create({
      data: { name: "Parallel adds", workspaceId: fixture.workspaceId },
    });
    const parallelCharts = await Promise.all(
      Array.from({ length: 8 }, (_unused, index) =>
        prisma.chart.create({
          data: {
            name: `Parallel ${index}`,
            type: "bar",
            workspaceId: fixture.workspaceId,
            feedbackDirectoryId: fixture.datasetId,
            query: { measures: ["FeedbackRecords.count"] },
            config: {},
          },
        })
      )
    );

    const responses = await Promise.all(
      parallelCharts.map((chart) =>
        addV3DashboardWidget({ dashboardId: board.id, body: { chartId: chart.id }, ...context(editor()) })
      )
    );
    expect(responses.map((response) => response.status)).toEqual(Array(8).fill(201));

    const layouts = (await prisma.dashboardWidget.findMany({ where: { dashboardId: board.id } })).map(
      (widget) => widget.layout as { x: number; y: number; w: number; h: number }
    );
    const overlapping = layouts.some((a, i) =>
      layouts
        .slice(i + 1)
        .some((b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y)
    );
    expect(layouts).toHaveLength(8);
    expect(overlapping).toBe(false);
  });
});

describe("layout bounds", () => {
  test("hold a layout to the 12-column grid and the grid's own size limits", () => {
    const valid = { x: 8, y: 0, w: 4, h: 8 };
    expect(ZV3WidgetLayoutInput.safeParse(valid).success).toBe(true);
    for (const invalid of [
      { ...valid, x: 9 }, // x + w past 12 columns
      { ...valid, w: 0 },
      { ...valid, w: 13, x: 0 },
      { ...valid, h: 9 },
      { ...valid, y: 1001 },
      { ...valid, x: 1.5 },
      { ...valid, extra: 1 },
    ]) {
      expect(ZV3WidgetLayoutInput.safeParse(invalid).success, JSON.stringify(invalid)).toBe(false);
    }
  });
});

describe("PATCH /api/v3/dashboards/{dashboardId}/widgets/{widgetId}", () => {
  const update = (body: { layout?: { x: number; y: number; w: number; h: number }; chartId?: string }) =>
    updateV3DashboardWidget({
      dashboardId,
      widgetId: firstWidgetId,
      body,
      auditLog: {} as never,
      ...context(editor()),
    });

  test("moves a widget and moves updatedAt; refuses moving it onto another widget", async () => {
    const moved = await update({ layout: { x: 0, y: 4, w: 6, h: 4 } });
    expect(moved.status).toBe(200);
    expect((await bodyOf<{ data: TV3DashboardWidget }>(moved)).data.layout).toEqual({
      x: 0,
      y: 4,
      w: 6,
      h: 4,
    });
    expect(await updatedAt()).toBeGreaterThan(STALE.getTime());

    await markStale();
    // The big number sits at x 4..7, y 0..2.
    expect((await update({ layout: { x: 3, y: 0, w: 4, h: 4 } })).status).toBe(422);
    expect(await updatedAt()).toBe(STALE.getTime());
  });

  test("repoints to another chart in place, at most once per dashboard", async () => {
    expect(await outcomeOf(await update({ chartId: charts.bigNumber }))).toEqual({
      status: 409,
      code: "conflict",
    });

    const repointed = (await bodyOf<{ data: TV3DashboardWidget }>(await update({ chartId: charts.spare })))
      .data;
    expect(repointed).toMatchObject({
      id: firstWidgetId,
      chartId: charts.spare,
      layout: { x: 0, y: 4, w: 6, h: 4 },
    });
    expect(repointed.chart.id).toBe(charts.spare);
    expect(await updatedAt()).toBeGreaterThan(STALE.getTime());
  });

  test("refuses a target chart in another workspace and a widget on another dashboard with 403", async () => {
    expect(await outcomeOf(await update({ chartId: charts.foreign }))).toEqual({
      status: 403,
      code: "forbidden",
    });

    const elsewhere = await prisma.dashboard.create({
      data: { name: "Elsewhere", workspaceId: fixture.workspaceId },
    });
    expect(
      await outcomeOf(
        await updateV3DashboardWidget({
          dashboardId: elsewhere.id,
          widgetId: firstWidgetId,
          body: { layout: { x: 0, y: 0, w: 4, h: 4 } },
          ...context(editor()),
        })
      )
    ).toEqual({ status: 403, code: "forbidden" });
    await prisma.dashboard.delete({ where: { id: elsewhere.id } });
  });
});

describe("DELETE /api/v3/dashboards/{dashboardId}/widgets/{widgetId}", () => {
  test("takes the widget off, keeps the chart, and moves updatedAt", async () => {
    const response = await removeV3DashboardWidget({
      dashboardId,
      widgetId: firstWidgetId,
      auditLog: {} as never,
      ...context(apiKeyOf(fixture, "writeKey")),
    });
    expect(response.status).toBe(204);
    expect(await prisma.dashboardWidget.findUnique({ where: { id: firstWidgetId } })).toBeNull();
    expect(await prisma.chart.findUnique({ where: { id: charts.spare } })).not.toBeNull();
    expect(await updatedAt()).toBeGreaterThan(STALE.getTime());

    expect(
      await outcomeOf(
        await removeV3DashboardWidget({ dashboardId, widgetId: firstWidgetId, ...context(editor()) })
      )
    ).toEqual({ status: 403, code: "forbidden" });
  });
});
