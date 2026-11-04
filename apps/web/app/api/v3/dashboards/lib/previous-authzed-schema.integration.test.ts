import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getV3DashboardChartData } from "@/app/api/v3/dashboards/lib/chart-data-operations";
import { listV3DashboardFilterValues } from "@/app/api/v3/dashboards/lib/filter-values-operations";
import { getV3Dashboard, listV3Dashboards } from "@/app/api/v3/dashboards/lib/operations";
import {
  ZV3DashboardChartDataQuery,
  ZV3DashboardFilterValuesQuery,
  ZV3DashboardListQuery,
} from "@/app/api/v3/dashboards/lib/schemas";
import { getV3DashboardWidget } from "@/app/api/v3/dashboards/lib/widget-operations";
import { type TDashboardsFixture, seedDashboardsFixture, sessionOf } from "@/integration/dashboards-fixture";
import { getAuthzedClient } from "@/lib/authzed/client";

/**
 * S2 (ADR-0025, D3): between deploying this release and applying its AuthZed schema, SpiceDB still holds
 * the 6.1 schema, which has no `dashboard_read` permission and no `dashboard_viewer` relation. Owners and
 * members must read dashboards, widgets, chart data and filter value lists exactly as before; only the
 * Dashboard viewer may depend on the new schema. This suite writes the 6.1 schema
 * (`integration/fixtures/authzed-schema-6.1.zed`, the schema of tag 6.1.3) into the harness's SpiceDB, runs
 * the dashboard-bound reads, and restores the release's schema afterwards.
 */

vi.mock("@cubejs-client/core", async (importOriginal) =>
  (await import("@/integration/cube-fake")).fakeCubeModule(await importOriginal())
);
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsDashboardsEnabled: vi.fn(async () => true),
  getAccessControlPermission: vi.fn(async () => true),
  getIsDashboardViewerRoleEnabled: vi.fn(async () => true),
}));

const FILTER_ID = "clfi000000000000000000001";
const PREVIOUS_SCHEMA_URL = new URL(
  "../../../../../integration/fixtures/authzed-schema-6.1.zed",
  import.meta.url
);
const RELEASE_SCHEMA_URL = new URL("../../../../../../../authzed/schema.zed", import.meta.url);

let fixture: TDashboardsFixture;
const ids = { chart: "", dashboard: "", widget: "", viewer: "" };

const ctx = (userId: string) => ({ authentication: sessionOf(userId), requestId: "req", instance: "/i" });

beforeAll(async () => {
  // Seeds PostgreSQL and converges SpiceDB on the release schema, pruning what earlier suites left —
  // including every `dashboard_viewer` relationship, without which the 6.1 schema could not be written.
  fixture = await seedDashboardsFixture();

  ids.chart = (
    await prisma.chart.create({
      data: {
        name: "Responses",
        type: "bar",
        workspaceId: fixture.workspaceId,
        feedbackDirectoryId: fixture.datasetId,
        query: { measures: ["FeedbackRecords.count"] },
        config: {},
      },
    })
  ).id;
  ids.dashboard = (
    await prisma.dashboard.create({
      data: {
        name: "Board",
        workspaceId: fixture.workspaceId,
        createdBy: fixture.users.owner,
        filters: [
          {
            id: FILTER_ID,
            field: "FeedbackRecords.sourceName",
            operator: "equals",
            label: "Source",
            values: ["Web"],
          },
        ],
      },
    })
  ).id;
  ids.widget = (
    await prisma.dashboardWidget.create({
      data: { dashboardId: ids.dashboard, chartId: ids.chart, layout: { x: 0, y: 0, w: 4, h: 3 }, order: 0 },
    })
  ).id;

  await getAuthzedClient().writeSchema(await readFile(PREVIOUS_SCHEMA_URL, "utf8"));

  // A viewer the 6.1 graph cannot hold: in PostgreSQL only, as right after the release's migration.
  const viewer = await prisma.user.create({ data: { email: "viewer@previous-schema.test", name: "V" } });
  ids.viewer = viewer.id;
  await prisma.membership.create({
    data: {
      accepted: true,
      organizationId: fixture.organizationId,
      role: "dashboard_viewer",
      userId: viewer.id,
    },
  });
}, 120_000);

afterAll(async () => {
  await getAuthzedClient().writeSchema(await readFile(RELEASE_SCHEMA_URL, "utf8"));
}, 60_000);

const reads = (userId: string) => ({
  list: () =>
    listV3Dashboards({
      query: ZV3DashboardListQuery.parse({ workspaceId: fixture.workspaceId }),
      ...ctx(userId),
    }),
  get: () => getV3Dashboard({ dashboardId: ids.dashboard, ...ctx(userId) }),
  widget: () => getV3DashboardWidget({ dashboardId: ids.dashboard, widgetId: ids.widget, ...ctx(userId) }),
  chartData: () =>
    getV3DashboardChartData({
      dashboardId: ids.dashboard,
      chartId: ids.chart,
      query: ZV3DashboardChartDataQuery.parse({}),
      ...ctx(userId),
    }),
  filterValues: () =>
    listV3DashboardFilterValues({
      dashboardId: ids.dashboard,
      filterId: "f1",
      query: ZV3DashboardFilterValuesQuery.parse({ "filter[f1]": "equals:FeedbackRecords.sourceName" }),
      ...ctx(userId),
    }),
});

describe("on the 6.1 AuthZed schema, before the release's schema is applied (S2)", () => {
  test.each([
    ["an owner", () => fixture.users.owner],
    ["a read & write member", () => fixture.users.editor],
    ["a read member", () => fixture.users.viewer],
  ])("%s reads dashboards, widgets, chart data and filter values as before", async (_label, user) => {
    const read = reads(user());
    for (const [name, call] of Object.entries(read)) {
      const response = await call();
      expect(response.status, `${name}: ${await response.clone().text()}`).toBe(200);
    }
  });

  test("a member without a grant is refused with the plain 403, never a 5xx", async () => {
    const read = reads(fixture.users.outsider);
    for (const [name, call] of Object.entries(read)) {
      expect((await call()).status, name).toBe(403);
    }
  });

  // ADR-0025: the 6.1 schema has no `dashboard_read`. SpiceDB answers the unknown permission with an error,
  // which the evaluator reads as a denial, so the viewer gets the same clean 403 as no grant, never a 5xx.
  test("only a Dashboard viewer is refused until the schema is applied, with the plain 403", async () => {
    const read = reads(ids.viewer);
    for (const [name, call] of Object.entries(read)) {
      const response = await call();
      expect(response.status, `${name}: ${await response.clone().text()}`).toBe(403);
    }
  });
});
