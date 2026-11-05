import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { cubeFake, resetCubeFake } from "@/integration/cube-fake";
import {
  type TDashboardsFixture,
  apiKeyOf,
  outcomeOf,
  seedDashboardsFixture,
  sessionOf,
} from "@/integration/dashboards-fixture";
import { getEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-member-name";
import { getV3DashboardChartData } from "./chart-data-operations";
import { listV3DashboardFilterFields } from "./filter-fields-operations";
import { listV3DashboardFilterValues } from "./filter-values-operations";
import { ZV3DashboardFilterFields } from "./resources";
import { ZV3DashboardChartDataQuery, ZV3DashboardFilterValuesQuery } from "./schemas";

/**
 * `GET /api/v3/dashboards/{dashboardId}/filter-fields` against real PostgreSQL, SpiceDB and Valkey, with
 * Cube faked at its client boundary for key discovery: the keys of the dashboard's charts' datasets only,
 * readable by a Dashboard viewer (whom the field catalog refuses), refused to someone outside the workspace.
 */

vi.mock("@cubejs-client/core", async (importOriginal) =>
  (await import("@/integration/cube-fake")).fakeCubeModule(await importOriginal())
);
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsDashboardsEnabled: vi.fn(async () => true),
  getIsDashboardViewerRoleEnabled: vi.fn(async () => true),
  getAccessControlPermission: vi.fn(async () => true),
}));

let fixture: TDashboardsFixture;
let dashboardViewer = "";
let sequence = 0;
const datasets = { onBoard: "", alsoOnBoard: "", offBoard: "" };

const createDataset = async () =>
  (
    await prisma.feedbackDirectory.create({
      data: {
        name: `Dataset ${++sequence}`,
        organizationId: fixture.organizationId,
        workspaces: { create: { workspaceId: fixture.workspaceId } },
      },
    })
  ).id;

const createChart = async (datasetId: string, dimensions: string[] = []) =>
  (
    await prisma.chart.create({
      data: {
        name: `Chart ${++sequence}`,
        type: "bar",
        workspaceId: fixture.workspaceId,
        feedbackDirectoryId: datasetId,
        query: { measures: ["FeedbackRecords.count"], ...(dimensions.length > 0 ? { dimensions } : {}) },
        config: {},
      },
    })
  ).id;

const createDashboard = async (chartIds: string[]) =>
  (
    await prisma.dashboard.create({
      data: {
        name: `Board ${++sequence}`,
        workspaceId: fixture.workspaceId,
        widgets: {
          create: chartIds.map((chartId, order) => ({
            chartId,
            layout: { x: order * 4, y: 0, w: 4, h: 4 },
            order,
          })),
        },
      },
      select: { id: true },
    })
  ).id;

const read = (dashboardId: string, authentication = sessionOf(fixture.users.editor)) =>
  listV3DashboardFilterFields({ dashboardId, authentication, requestId: "req", instance: "/api/v3" });

const fieldsOf = async (response: Response) => {
  expect(response.status).toBe(200);
  return ZV3DashboardFilterFields.parse(((await response.json()) as { data: unknown }).data).fields;
};

const field = (key: string) => ({ name: getEmbeddedMemberName(key), key, label: key });

beforeAll(async () => {
  fixture = await seedDashboardsFixture();
  datasets.onBoard = await createDataset();
  datasets.alsoOnBoard = await createDataset();
  datasets.offBoard = await createDataset();

  // A Dashboard viewer of the workspace, through a team, as the role is granted.
  const user = await prisma.user.create({ data: { email: "fields-viewer@viewer.test", name: "Viewer" } });
  dashboardViewer = user.id;
  await prisma.membership.create({
    data: {
      accepted: true,
      organizationId: fixture.organizationId,
      role: "dashboard_viewer",
      userId: user.id,
    },
  });
  const team = await prisma.team.create({
    data: { name: "Viewers", organizationId: fixture.organizationId },
  });
  await prisma.teamUser.create({ data: { role: "contributor", teamId: team.id, userId: user.id } });
  await prisma.workspaceTeam.create({
    data: { permission: "read", teamId: team.id, workspaceId: fixture.workspaceId },
  });
  await synchronizeAuthzedIntegrationFixture();
}, 120_000);

beforeEach(() => {
  resetCubeFake();
  cubeFake.discoveredKeys[datasets.onBoard] = ["Plan", "Region"];
  cubeFake.discoveredKeys[datasets.alsoOnBoard] = ["Plan", "Tier"];
  cubeFake.discoveredKeys[datasets.offBoard] = ["Secret"];
});

describe("a dashboard's embedded-data filter fields", () => {
  test("are the keys of its charts' datasets, once each and in key order, and no other dataset's", async () => {
    const dashboard = await createDashboard([
      await createChart(datasets.onBoard),
      await createChart(datasets.alsoOnBoard),
      await createChart(datasets.onBoard),
    ]);

    expect(await fieldsOf(await read(dashboard))).toEqual([field("Plan"), field("Region"), field("Tier")]);
  });

  test("are listed in full to a read-only API key, as for an editor", async () => {
    const dashboard = await createDashboard([await createChart(datasets.onBoard)]);

    expect(await fieldsOf(await read(dashboard, apiKeyOf(fixture, "readKey")))).toEqual([
      field("Plan"),
      field("Region"),
    ]);
  });

  // ADR-0025: a key can hold anything, so a viewer gets only the keys the charts already show them.
  test("are, for a Dashboard viewer, only the keys some chart on the dashboard groups by", async () => {
    const ungrouped = await createDashboard([await createChart(datasets.onBoard)]);
    expect(await fieldsOf(await read(ungrouped, sessionOf(dashboardViewer)))).toEqual([]);

    const grouped = await createDashboard([
      await createChart(datasets.onBoard, [getEmbeddedMemberName("Region")]),
      await createChart(datasets.alsoOnBoard),
    ]);
    expect(await fieldsOf(await read(grouped, sessionOf(dashboardViewer)))).toEqual([field("Region")]);
    expect(await fieldsOf(await read(grouped))).toEqual([field("Plan"), field("Region"), field("Tier")]);
  });

  test("are refused to a member outside the workspace, and for a dashboard that does not exist", async () => {
    const dashboard = await createDashboard([await createChart(datasets.onBoard)]);

    expect(await outcomeOf(await read(dashboard, sessionOf(fixture.users.outsider)))).toEqual({
      status: 403,
      code: "forbidden",
    });
    expect((await read("clnodashboard00000000001")).status).toBe(403);
  });

  test("are none for a dashboard without charts, without scanning any dataset", async () => {
    expect(await fieldsOf(await read(await createDashboard([])))).toEqual([]);
    expect(cubeFake.discoveries).toHaveLength(0);
  });
});

describe("a Dashboard viewer naming embedded data no chart groups by", () => {
  const values = (dashboardId: string, key: string, authentication = sessionOf(dashboardViewer)) =>
    listV3DashboardFilterValues({
      dashboardId,
      filterId: "f1",
      query: ZV3DashboardFilterValuesQuery.parse({ "filter[f1]": `equals:${getEmbeddedMemberName(key)}` }),
      authentication,
      requestId: "req",
      instance: "/api/v3",
    });
  const chartData = (dashboardId: string, chartId: string, key: string) =>
    getV3DashboardChartData({
      dashboardId,
      chartId,
      query: ZV3DashboardChartDataQuery.parse({
        "filter[f1]": `equals:${getEmbeddedMemberName(key)}`,
        "picks[f1]": "x",
      }),
      authentication: sessionOf(dashboardViewer),
      requestId: "req",
      instance: "/api/v3",
    });

  test("is refused its values and its filter on the charts, and allowed both for a grouped key", async () => {
    const chart = await createChart(datasets.onBoard, [getEmbeddedMemberName("Region")]);
    const dashboard = await createDashboard([chart]);

    expect(await outcomeOf(await values(dashboard, "Plan"))).toEqual({ status: 403, code: "forbidden" });
    expect(await outcomeOf(await chartData(dashboard, chart, "Plan"))).toEqual({
      status: 403,
      code: "forbidden",
    });

    expect((await values(dashboard, "Region")).status).toBe(200);
    expect((await chartData(dashboard, chart, "Region")).status).toBe(200);
    // Anyone else may still list any key's values.
    expect((await values(dashboard, "Plan", sessionOf(fixture.users.editor))).status).toBe(200);
  });
});
