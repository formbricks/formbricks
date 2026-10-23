import { beforeAll, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { addV3DashboardWidget } from "@/app/api/v3/dashboards/lib/widget-operations";
import {
  type TDashboardsFixture,
  apiKeyOf,
  outcomeOf,
  seedDashboardsFixture,
  sessionOf,
} from "@/integration/dashboards-fixture";
import { deleteV3Chart } from "./operations";

/**
 * Deleting a chart against real PostgreSQL and SpiceDB (ENG-6590): allowed only for a chart on no
 * dashboard, refused with the dashboards that hold it otherwise — atomically, so a widget added at the
 * same moment is never cascaded away.
 */

vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsDashboardsEnabled: vi.fn(async () => true),
}));

let fixture: TDashboardsFixture;

const context = (authentication = sessionOf(fixture.users.editor)) => ({
  authentication,
  requestId: "req",
  instance: "/api/v3/charts",
});

const createChart = (name: string) =>
  prisma.chart.create({
    data: {
      name,
      type: "bar",
      workspaceId: fixture.workspaceId,
      feedbackDirectoryId: fixture.datasetId,
      query: { measures: ["FeedbackRecords.count"] },
      config: {},
    },
  });

const createDashboard = (name: string, chartId?: string) =>
  prisma.dashboard.create({
    data: {
      name,
      workspaceId: fixture.workspaceId,
      ...(chartId
        ? { widgets: { create: [{ chartId, layout: { x: 0, y: 0, w: 4, h: 4 }, order: 0 }] } }
        : {}),
    },
  });

beforeAll(async () => {
  fixture = await seedDashboardsFixture();
}, 120_000);

describe("DELETE /api/v3/charts/{chartId}", () => {
  test("deletes a chart on no dashboard, audited, and answers 403 once it is gone", async () => {
    const chart = await createChart("Unused");
    const log: Record<string, unknown> = {};

    const response = await deleteV3Chart({ chartId: chart.id, auditLog: log as never, ...context() });
    expect(response.status).toBe(204);
    expect(await prisma.chart.findUnique({ where: { id: chart.id } })).toBeNull();
    expect(log).toMatchObject({ targetId: chart.id, oldObject: { name: "Unused" } });

    expect(await outcomeOf(await deleteV3Chart({ chartId: chart.id, ...context() }))).toEqual({
      status: 403,
      code: "forbidden",
    });
  });

  test("refuses a chart in use with chart_in_use naming its dashboards, and deletes nothing", async () => {
    const chart = await createChart("In use");
    const zulu = await createDashboard("Zulu", chart.id);
    const alpha = await createDashboard("Alpha", chart.id);

    const response = await deleteV3Chart({ chartId: chart.id, ...context() });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "chart_in_use",
      details: {
        dashboards: [
          { id: alpha.id, name: "Alpha" },
          { id: zulu.id, name: "Zulu" },
        ],
      },
    });
    expect(await prisma.chart.findUnique({ where: { id: chart.id } })).not.toBeNull();
    expect(await prisma.dashboardWidget.count({ where: { chartId: chart.id } })).toBe(2);
  });

  test("needs write access to the chart's workspace", async () => {
    const chart = await createChart("Protected");
    for (const authentication of [sessionOf(fixture.users.viewer), apiKeyOf(fixture, "readKey")]) {
      expect(await outcomeOf(await deleteV3Chart({ chartId: chart.id, ...context(authentication) }))).toEqual(
        {
          status: 403,
          code: "forbidden",
        }
      );
    }
    expect(await prisma.chart.findUnique({ where: { id: chart.id } })).not.toBeNull();
  });

  test("never cascades away a widget added at the same moment", async () => {
    for (let round = 0; round < 8; round++) {
      const chart = await createChart(`Race ${round}`);
      const dashboard = await createDashboard(`Race board ${round}`);

      const [deleted, added] = await Promise.all([
        deleteV3Chart({ chartId: chart.id, ...context() }),
        addV3DashboardWidget({ dashboardId: dashboard.id, body: { chartId: chart.id }, ...context() }),
      ]);

      const chartExists = (await prisma.chart.findUnique({ where: { id: chart.id } })) !== null;
      const widgetExists = (await prisma.dashboardWidget.count({ where: { chartId: chart.id } })) > 0;

      // Exactly one of them won, and what it left behind is consistent.
      expect([deleted.status, added.status].sort()).toEqual(chartExists ? [201, 409] : [204, 403]);
      expect(widgetExists).toBe(chartExists);
    }
  });
});
