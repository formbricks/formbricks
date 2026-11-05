import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { TChartQuery } from "@formbricks/types/analysis";
import { getV3ChartData } from "@/app/api/v3/charts/lib/data-operations";
import { ZV3ChartDataQuery } from "@/app/api/v3/charts/lib/schemas";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { cubeFake, resetCubeFake } from "@/integration/cube-fake";
import { type TDashboardsFixture, seedDashboardsFixture, sessionOf } from "@/integration/dashboards-fixture";
import type { TLockedDashboardFilter } from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";
import { MAX_EMBEDDED_KEYS } from "@/modules/ee/analysis/lib/embedded-data-fields";
import { getEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-member-name";
import { getV3DashboardChartData } from "./chart-data-operations";
import { listV3DashboardFilterFields } from "./filter-fields-operations";
import { listV3DashboardFilterValues } from "./filter-values-operations";
import { replaceV3Dashboard } from "./operations";
import { ZV3DashboardChartData, ZV3DashboardFilterFields } from "./resources";
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

const createDashboard = async (chartIds: string[], filters: TLockedDashboardFilter[]) =>
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

/** Locked on the dashboard with its value, so it narrows every read. */
const planFilter: TLockedDashboardFilter = {
  id: FILTER_ID,
  field: PLAN,
  operator: "equals",
  label: "Plan",
  values: ["Pro"],
};

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
  test("is saved locked, and narrows every read of only the charts whose dataset has the key", async () => {
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
        // No filter in the request: the saved one applies on its own.
        query: ZV3DashboardChartDataQuery.parse({}),
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
    // A locked filter goes by its place on the dashboard within a read, and keeps its saved label.
    expect(unfilterable.unfilterableFilters).toEqual([{ id: "locked.0", label: "Plan" }]);
    // The chart that cannot be narrowed never reaches Cube.
    expect(cubeFake.calls).toHaveLength(1);
  });

  const saveFilters = async (dashboard: { id: string; updatedAt: Date }, filters: TLockedDashboardFilter[]) =>
    replaceV3Dashboard({
      dashboardId: dashboard.id,
      body: ZV3DashboardReplaceBody.parse({
        name: `Board ${++sequence}`,
        expectedUpdatedAt: dashboard.updatedAt.toISOString(),
        filters,
        widgets: (
          await prisma.dashboardWidget.findMany({
            where: { dashboardId: dashboard.id },
            select: { id: true, layout: true, order: true },
          })
        ).map(({ id, layout, order }) => ({ widgetId: id, layout, order })),
      }),
      ...ctx(),
    });

  test("is refused, naming it, when no chart's dataset has the key", async () => {
    const withRegion = await createDataset(["Region"]);
    await syncDatasets();
    const chart = await createChart(withRegion, { measures: [COUNT], dimensions: [SOURCE] });
    const dashboard = await createDashboard([chart], []);

    const refused = await saveFilters(dashboard, [planFilter]);

    expect(refused.status).toBe(422);
    const problem = (await refused.json()) as { invalid_params: { name: string; code: string }[] };
    expect(problem.invalid_params).toEqual([
      expect.objectContaining({ name: "filters[0].field", code: "invalid_reference" }),
    ]);
    expect((await prisma.dashboard.findUniqueOrThrow({ where: { id: dashboard.id } })).filters).toEqual([]);
  });

  test("an empty dashboard takes no embedded-data filter, and a saved one keeps saving", async () => {
    const emptyBoard = await createDashboard([], []);
    expect((await saveFilters(emptyBoard, [planFilter])).status).toBe(422);

    // A filter saved while a chart had the key keeps saving after the key is gone from every chart.
    const withRegion = await createDataset(["Region"]);
    await syncDatasets();
    const chart = await createChart(withRegion, { measures: [COUNT] });
    const kept = await createDashboard([chart], [planFilter]);
    const saved = await saveFilters(kept, [planFilter]);
    expect(saved.status, await saved.clone().text()).toBe(200);
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
      []
    );
    cubeFake.respond = ({ query }) =>
      (query.measures ?? []).length === 0
        ? [{ [PLAN]: "Pro" }, { [PLAN]: "Free" }].filter(() => (query.dimensions ?? []).includes(PLAN))
        : [];

    const response = await listV3DashboardFilterValues({
      dashboardId: dashboard.id,
      filterId: "plan",
      query: ZV3DashboardFilterValuesQuery.parse({ "filter[plan]": `equals:${PLAN}` }),
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

describe("an embedded-data key whose Embedded Data fields are all numbers", () => {
  const SEATS = getEmbeddedMemberName("Seats");

  /** A survey of the fixture's workspace, mapped into `datasetId`, publishing one Embedded Data field per name. */
  const mapSurveyWithFields = async (datasetId: string, fields: Record<string, "number" | "string">) => {
    const survey = await prisma.survey.create({
      data: {
        name: `Survey ${++sequence}`,
        type: "link",
        status: "inProgress",
        workspaceId: fixture.workspaceId,
      },
      select: { id: true },
    });
    let order = 0;
    for (const [name, dataType] of Object.entries(fields)) {
      const field = await prisma.embeddedData.create({
        data: { name, source: "ingested", dataType, workspaceId: fixture.workspaceId, surveyId: survey.id },
      });
      await prisma.surveyEmbeddedData.create({
        data: {
          workspaceId: fixture.workspaceId,
          surveyId: survey.id,
          embeddedDataId: field.id,
          storageKey: `${name}-${sequence}`,
          order: order++,
        },
      });
    }
    const source = await prisma.feedbackSource.create({
      data: {
        name: `Source ${++sequence}`,
        type: "formbricks_survey",
        workspaceId: fixture.workspaceId,
        feedbackDirectoryId: datasetId,
      },
    });
    await prisma.feedbackSourceFormbricksMapping.create({
      data: {
        feedbackSourceId: source.id,
        workspaceId: fixture.workspaceId,
        surveyId: survey.id,
        elementId: "q1",
        hubFieldType: "nps",
      },
    });
  };

  const readChart = (
    dashboardId: string,
    chartId: string,
    rules: Record<string, string>,
    picks: Record<string, string[]>
  ) =>
    getV3DashboardChartData({
      dashboardId,
      chartId,
      query: ZV3DashboardChartDataQuery.parse({ rules, picks }),
      ...ctx(),
    });

  test("is listed as a number, and gt on it reaches Cube on its numeric twin", async () => {
    const dataset = await createDataset(["Seats", "Plan"]);
    await syncDatasets();
    await mapSurveyWithFields(dataset, { Seats: "number", Plan: "string" });
    const chart = await createChart(dataset, { measures: [COUNT], dimensions: [SOURCE] });
    const dashboard = await createDashboard([chart], []);

    const listed = await listV3DashboardFilterFields({ dashboardId: dashboard.id, ...ctx() });
    expect(listed.status, await listed.clone().text()).toBe(200);
    expect(ZV3DashboardFilterFields.parse((await listed.json()).data).fields).toEqual([
      { name: PLAN, key: "Plan", label: "Plan", type: "string" },
      { name: SEATS, key: "Seats", label: "Seats", type: "number" },
    ]);

    const read = await readChart(dashboard.id, chart, { f1: `gt:${SEATS}` }, { f1: ["10"] });
    expect(read.status, await read.clone().text()).toBe(200);
    expect(cubeFake.calls).toHaveLength(1);
    expect(cubeFake.calls[0].query.filters).toEqual(
      expect.arrayContaining([
        {
          member: SEATS.replace("FeedbackRecords.ed_", "FeedbackRecords.edn_"),
          operator: "gt",
          values: ["10"],
        },
      ])
    );
    // The twin's key travels in the token, so the dataset's model compiles it.
    expect(cubeFake.calls[0].claims.edKeys).toContain("Seats");

    // A pick that is no number is the caller's to fix.
    expect((await readChart(dashboard.id, chart, { f1: `gt:${SEATS}` }, { f1: ["ten"] })).status).toBe(422);
  });

  test("answers 422 for gt on a key that is text on the dashboard, or that fields of two types share", async () => {
    const dataset = await createDataset(["Seats", "Plan"]);
    await syncDatasets();
    await mapSurveyWithFields(dataset, { Seats: "number", Plan: "string" });
    // A second survey declares Seats as text: the key is no longer a number on this dashboard.
    await mapSurveyWithFields(dataset, { Seats: "string" });
    const chart = await createChart(dataset, { measures: [COUNT], dimensions: [SOURCE] });
    const dashboard = await createDashboard([chart], []);

    for (const field of [PLAN, SEATS]) {
      const refused = await readChart(dashboard.id, chart, { f1: `gt:${field}` }, { f1: ["10"] });
      expect(refused.status).toBe(422);
      const problem = (await refused.json()) as { invalid_params: { name: string }[] };
      expect(problem.invalid_params.map(({ name }) => name)).toEqual(["filter[f1]"]);
    }
    expect(cubeFake.calls).toHaveLength(0);

    // Locking one on the dashboard is refused the same way.
    const saved = await replaceV3Dashboard({
      dashboardId: dashboard.id,
      body: ZV3DashboardReplaceBody.parse({
        name: "Seats",
        expectedUpdatedAt: dashboard.updatedAt.toISOString(),
        filters: [{ id: FILTER_ID, field: SEATS, operator: "gt", label: "Seats", values: ["10"] }],
        widgets: (
          await prisma.dashboardWidget.findMany({
            where: { dashboardId: dashboard.id },
            select: { id: true, layout: true, order: true },
          })
        ).map(({ id, layout, order }) => ({ widgetId: id, layout, order })),
      }),
      ...ctx(),
    });
    expect(saved.status).toBe(422);
  });
});
