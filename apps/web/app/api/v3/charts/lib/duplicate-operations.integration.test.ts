import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  type TDashboardsFixture,
  apiKeyOf,
  outcomeOf,
  seedDashboardsFixture,
  sessionOf,
} from "@/integration/dashboards-fixture";
import { duplicateV3Chart } from "./duplicate-operations";
import type { TV3ChartResource } from "./resources";

/**
 * Chart duplication against real PostgreSQL and SpiceDB (ENG-6595): the copy, its "(copy)" name, and
 * placing it on a dashboard in the same transaction — so a failure there leaves no copy behind.
 */

vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsDashboardsEnabled: vi.fn(async () => true),
}));

let fixture: TDashboardsFixture;
let sourceId = "";
let dashboardId = "";
const STALE = new Date("2026-01-01T00:00:00Z");

const context = (authentication = sessionOf(fixture.users.editor)) => ({
  authentication,
  requestId: "req",
  instance: "/api/v3/charts/duplicate",
});

const duplicate = (
  body: Record<string, unknown> = {},
  chartId = sourceId,
  authentication?: ReturnType<typeof sessionOf>
) => duplicateV3Chart({ chartId, body, auditLog: {} as never, ...context(authentication) });

const bodyOf = async <T>(response: Response) => (await response.json()) as T;

const copiesOfSource = () => prisma.chart.count({ where: { name: { startsWith: "Weekly NPS (copy" } } });

beforeAll(async () => {
  fixture = await seedDashboardsFixture();
  sourceId = (
    await prisma.chart.create({
      data: {
        name: "Weekly NPS",
        type: "bar",
        workspaceId: fixture.workspaceId,
        feedbackDirectoryId: fixture.datasetId,
        query: { measures: ["FeedbackRecords.npsScore"] },
        config: { showLegend: false },
      },
    })
  ).id;
}, 120_000);

beforeEach(async () => {
  await prisma.chart.deleteMany({ where: { name: { startsWith: "Weekly NPS (copy" } } });
  await prisma.dashboard.deleteMany({ where: { workspaceId: fixture.workspaceId } });
  dashboardId = (
    await prisma.dashboard.create({
      data: {
        name: "Board",
        workspaceId: fixture.workspaceId,
        updatedAt: STALE,
        widgets: { create: [{ chartId: sourceId, layout: { x: 0, y: 0, w: 6, h: 4 }, order: 0 }] },
      },
    })
  ).id;
});

const dashboardUpdatedAt = async () =>
  (await prisma.dashboard.findUniqueOrThrow({ where: { id: dashboardId } })).updatedAt.getTime();

describe("POST /api/v3/charts/{chartId}/duplicate", () => {
  test("copies the chart under a unique (copy) name, leaving dashboards alone", async () => {
    const first = await duplicate();
    expect(first.status).toBe(201);
    const copy = (await bodyOf<{ data: TV3ChartResource }>(first)).data;
    expect(first.headers.get("Location")).toBe(`/api/v3/charts/${copy.id}`);
    expect(copy).toMatchObject({
      name: "Weekly NPS (copy)",
      datasetId: fixture.datasetId,
      type: "bar",
      query: { measures: ["FeedbackRecords.npsScore"] },
      config: { showLegend: false },
      dashboards: [],
    });
    expect(await dashboardUpdatedAt()).toBe(STALE.getTime());

    const second = (await bodyOf<{ data: TV3ChartResource }>(await duplicate())).data;
    expect(second.name).toBe("Weekly NPS (copy 2)");
    // Copying a copy names it after the original.
    const ofCopy = (await bodyOf<{ data: TV3ChartResource }>(await duplicate({}, copy.id))).data;
    expect(ofCopy.name).toBe("Weekly NPS (copy 3)");

    expect(await outcomeOf(await duplicate({ name: "Weekly NPS" }))).toEqual({
      status: 409,
      code: "conflict",
    });
  });

  test("puts the copy on a dashboard in the first open slot and moves its updatedAt", async () => {
    const response = await duplicate({ dashboardId });
    expect(response.status).toBe(201);
    const copy = (await bodyOf<{ data: TV3ChartResource }>(response)).data;
    expect(copy.dashboards).toEqual([{ id: dashboardId, name: "Board" }]);

    const widget = await prisma.dashboardWidget.findFirstOrThrow({ where: { chartId: copy.id } });
    expect(widget).toMatchObject({ dashboardId, layout: { x: 6, y: 0, w: 4, h: 4 }, order: 1 });
    expect(await dashboardUpdatedAt()).toBeGreaterThan(STALE.getTime());
  });

  test("leaves no copy when the layout overlaps a widget", async () => {
    const response = await duplicate({ dashboardId, layout: { x: 2, y: 0, w: 6, h: 4 } });
    expect(await outcomeOf(response)).toEqual({ status: 422, code: "unprocessable_content" });
    expect(await copiesOfSource()).toBe(0);
    expect(await dashboardUpdatedAt()).toBe(STALE.getTime());
  });

  describe("when placing the copy fails in the database", () => {
    beforeEach(async () => {
      // A trigger stands in for any failure after the copy is written: the widget insert raises.
      await prisma.$executeRawUnsafe(
        `CREATE OR REPLACE FUNCTION eng6595_fail_widget() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'placement failed'; END $$ LANGUAGE plpgsql`
      );
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER eng6595_fail_widget BEFORE INSERT ON "DashboardWidget" FOR EACH ROW EXECUTE FUNCTION eng6595_fail_widget()`
      );
    });

    afterEach(async () => {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS eng6595_fail_widget ON "DashboardWidget"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS eng6595_fail_widget()`);
    });

    test("rolls the copy back with it", async () => {
      const response = await duplicate({ dashboardId });
      expect(response.status).toBe(500);
      expect(await copiesOfSource()).toBe(0);
      expect(await dashboardUpdatedAt()).toBe(STALE.getTime());
    });
  });

  test("needs write access to the workspace and the dataset, and a dashboard in the same workspace", async () => {
    const foreignDashboard = await prisma.dashboard.create({
      data: { name: "Foreign", workspaceId: fixture.foreignWorkspaceId },
    });
    const unassigned = await prisma.chart.create({
      data: {
        name: "Unassigned dataset",
        type: "bar",
        workspaceId: fixture.workspaceId,
        feedbackDirectoryId: fixture.unassignedDatasetId,
        query: { measures: ["FeedbackRecords.count"] },
        config: {},
      },
    });

    for (const response of [
      await duplicate({}, sourceId, sessionOf(fixture.users.viewer)),
      await duplicate({}, sourceId, apiKeyOf(fixture, "readKey")),
      await duplicate({ dashboardId: foreignDashboard.id }),
      await duplicate({}, unassigned.id, sessionOf(fixture.users.owner)),
    ]) {
      expect(await outcomeOf(response)).toEqual({ status: 403, code: "forbidden" });
    }
    expect(await copiesOfSource()).toBe(0);
    expect(await prisma.chart.count({ where: { name: { startsWith: "Unassigned dataset (copy" } } })).toBe(0);
  });
});
