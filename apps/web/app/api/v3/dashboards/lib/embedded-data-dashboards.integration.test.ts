import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { TChartQuery } from "@formbricks/types/analysis";
import { getV3ChartData } from "@/app/api/v3/charts/lib/data-operations";
import { ZV3ChartDataQuery } from "@/app/api/v3/charts/lib/schemas";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { cubeFake, resetCubeFake } from "@/integration/cube-fake";
import { type TDashboardsFixture, seedDashboardsFixture, sessionOf } from "@/integration/dashboards-fixture";
import type { TDashboardFilter } from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";
import { MAX_EMBEDDED_KEYS } from "@/modules/ee/analysis/lib/embedded-data-fields";
import { getEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-member-name";
import { getV3DashboardChartData } from "./chart-data-operations";
import { listV3DashboardFilterValues } from "./filter-values-operations";
import { replaceV3Dashboard } from "./operations";
import { ZV3DashboardChartData } from "./resources";
import {
  ZV3DashboardChartDataQuery,
  ZV3DashboardFilterValuesQuery,
  ZV3DashboardReplaceBody,
} from "./schemas";

/**
 * Embedded data on dashboards (ENG-6893 with ENG-6898 and ENG-6927) against real PostgreSQL, SpiceDB and
 * Valkey, with Cube faked at its client boundary: a dashboard filter on an embedded-data key matches the
 * charts whose dataset has the key, by its own name; its value list asks only those datasets; and a saved
 * chart keeps working once its key falls out of the dataset's top 100. Each test uses its own datasets,
 * so the key lists Valkey keeps per dataset never carry over.
 */

vi.mock("@cubejs-client/core", async (importOriginal) =>
  (await import("@/integration/cube-fake")).fakeCubeModule(await importOriginal())
);
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsDashboardsEnabled: vi.fn(async () => true),
}));

const COUNT = "FeedbackRecords.count";
const SOURCE = "FeedbackRecords.sourceName";
const PLAN = getEmbeddedMemberName("Plan");
const FILTER_ID = "clfi000000000000000000001";

let fixture: TDashboardsFixture;
let sequence = 0;

const ctx = () => ({
  authentication: sessionOf(fixture.users.editor),
  requestId: "req",
  instance: "/api/v3/dashboards",
});

const createDataset = async (keys: string[]) => {
  const dataset = await prisma.feedbackDirectory.create({
    data: {
      name: `Dataset ${++sequence}`,
      organizationId: fixture.organizationId,
      workspaces: { create: { workspaceId: fixture.workspaceId } },
    },
  });
  cubeFake.discoveredKeys[dataset.id] = keys;
  return dataset.id;
};

const createChart = async (datasetId: string, query: TChartQuery) =>
  (
    await prisma.chart.create({
      data: {
        name: `Chart ${++sequence}`,
        type: "bar",
        workspaceId: fixture.workspaceId,
        feedbackDirectoryId: datasetId,
        query,
        config: {},
      },
    })
  ).id;

const createDashboard = async (chartIds: string[], filters: TDashboardFilter[]) =>
  prisma.dashboard.create({
    data: {
      name: `Board ${++sequence}`,
      workspaceId: fixture.workspaceId,
      filters,
      widgets: {
        create: chartIds.map((chartId, order) => ({
          chartId,
          layout: { x: (order % 3) * 4, y: Math.floor(order / 3) * 4, w: 4, h: 4 },
          order,
        })),
      },
    },
    select: { id: true, updatedAt: true },
  });

const planFilter: TDashboardFilter = { id: FILTER_ID, field: PLAN, operator: "equals", label: "Plan" };

beforeAll(async () => {
  fixture = await seedDashboardsFixture();
  // The datasets are created per test, after this sync; the fixture's own grants are what SpiceDB needs.
  await synchronizeAuthzedIntegrationFixture();
}, 120_000);

beforeEach(() => {
  resetCubeFake();
});

/** Datasets are assigned after the fixture sync, so their assignment edges are projected per test. */
const syncDatasets = () => synchronizeAuthzedIntegrationFixture();

describe("a dashboard filter on an embedded-data key", () => {
  test("is saved, and narrows only the charts whose dataset has the key", async () => {
    const withPlan = await createDataset(["Plan", "Region"]);
    const withoutPlan = await createDataset(["Region"]);
    await syncDatasets();
    const planChart = await createChart(withPlan, { measures: [COUNT], dimensions: [SOURCE] });
    const otherChart = await createChart(withoutPlan, { measures: [COUNT], dimensions: [SOURCE] });
    const dashboard = await createDashboard([planChart, otherChart], []);

    const saved = await replaceV3Dashboard({
      dashboardId: dashboard.id,
      body: ZV3DashboardReplaceBody.parse({
        name: "Plans",
        expectedUpdatedAt: dashboard.updatedAt.toISOString(),
        filters: [planFilter],
        widgets: (
          await prisma.dashboardWidget.findMany({
            where: { dashboardId: dashboard.id },
            select: { id: true, layout: true, order: true },
          })
        ).map(({ id, layout, order }) => ({ widgetId: id, layout, order })),
      }),
      ...ctx(),
    });
    expect(saved.status, await saved.clone().text()).toBe(200);

    const read = (chartId: string) =>
      getV3DashboardChartData({
        dashboardId: dashboard.id,
        chartId,
        query: ZV3DashboardChartDataQuery.parse({ [`picks[${FILTER_ID}]`]: "Pro" }),
        ...ctx(),
      });

    const narrowed = await read(planChart);
    expect(narrowed.status, await narrowed.clone().text()).toBe(200);
    expect(ZV3DashboardChartData.parse((await narrowed.json()).data).unfilterableFilters).toEqual([]);
    expect(cubeFake.calls).toHaveLength(1);
    expect(cubeFake.calls[0].query.filters).toEqual(
      expect.arrayContaining([expect.objectContaining({ member: PLAN, operator: "equals", values: ["Pro"] })])
    );
    expect(cubeFake.calls[0].claims.edKeys).toContain("Plan");

    const unfilterable = ZV3DashboardChartData.parse((await (await read(otherChart)).json()).data);
    expect(unfilterable.rows).toEqual([]);
    expect(unfilterable.unfilterableFilters).toEqual([{ id: FILTER_ID, label: "Plan" }]);
    // The chart that cannot be narrowed never reaches Cube.
    expect(cubeFake.calls).toHaveLength(1);
  });

  test("lists values from the datasets that have the key only", async () => {
    const withPlan = await createDataset(["Plan"]);
    const withoutPlan = await createDataset([]);
    await syncDatasets();
    const dashboard = await createDashboard(
      [
        await createChart(withPlan, { measures: [COUNT], dimensions: [SOURCE] }),
        await createChart(withoutPlan, { measures: [COUNT], dimensions: [SOURCE] }),
      ],
      [planFilter]
    );
    cubeFake.respond = ({ query }) =>
      (query.measures ?? []).length === 0
        ? [{ [PLAN]: "Pro" }, { [PLAN]: "Free" }].filter(() => (query.dimensions ?? []).includes(PLAN))
        : [];

    const response = await listV3DashboardFilterValues({
      dashboardId: dashboard.id,
      filterId: FILTER_ID,
      query: ZV3DashboardFilterValuesQuery.parse({}),
      ...ctx(),
    });

    expect(response.status, await response.clone().text()).toBe(200);
    const values = ((await response.json()) as { data: { values: Array<{ value: string }> } }).data.values;
    expect(values.map(({ value }) => value).sort()).toEqual(["Free", "Pro"]);
    expect(cubeFake.calls).toHaveLength(1);
    expect(cubeFake.calls[0].claims.tenantId).toBe(withPlan);
    expect(cubeFake.calls[0].query.dimensions).toEqual([PLAN]);
  });
});

describe("a saved chart on an embedded-data key", () => {
  test("heads its column with the key's own name", async () => {
    const datasetId = await createDataset(["Plan"]);
    await syncDatasets();
    const chartId = await createChart(datasetId, { measures: [COUNT], dimensions: [PLAN] });
    cubeFake.rows = [{ [PLAN]: "Pro", [COUNT]: 3 }];

    const response = await getV3ChartData({ chartId, query: ZV3ChartDataQuery.parse({}), ...ctx() });

    expect(response.status, await response.clone().text()).toBe(200);
    const { data } = (await response.json()) as { data: { memberLabels: Record<string, string> } };
    expect(data.memberLabels).toEqual({ [PLAN]: "Plan" });
  });

  test("keeps working after its key falls out of the dataset's top 100", async () => {
    const top = Array.from({ length: MAX_EMBEDDED_KEYS }, (_, index) => `key_${index}`);
    const datasetId = await createDataset([...top, "Rare plan"]);
    await syncDatasets();
    const rare = getEmbeddedMemberName("Rare plan");
    const chartId = await createChart(datasetId, { measures: [COUNT], dimensions: [rare] });

    const response = await getV3ChartData({ chartId, query: ZV3ChartDataQuery.parse({}), ...ctx() });

    expect(response.status, await response.clone().text()).toBe(200);
    const { data } = (await response.json()) as { data: { memberLabels: Record<string, string> } };
    expect(data.memberLabels).toEqual({ [rare]: "Rare plan" });
    // The token keeps every top key and adds the saved chart's key's rare-key bucket (S5), in canonical
    // order: here the only rarer key is "Rare plan".
    const edKeys = cubeFake.calls[0].claims.edKeys as string[];
    expect(edKeys).toEqual([...top, "Rare plan"].sort());
    expect(edKeys).toHaveLength(MAX_EMBEDDED_KEYS + 1);
  });

  test("still refuses a member whose key the dataset does not have", async () => {
    const datasetId = await createDataset(["Plan"]);
    await syncDatasets();
    const chartId = await createChart(datasetId, {
      measures: [COUNT],
      dimensions: [getEmbeddedMemberName("Never collected")],
    });

    const response = await getV3ChartData({ chartId, query: ZV3ChartDataQuery.parse({}), ...ctx() });

    expect(response.status).toBe(422);
    expect(cubeFake.calls).toHaveLength(0);
  });
});
