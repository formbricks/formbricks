import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { TChartQuery } from "@formbricks/types/analysis";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { cubeFake, resetCubeFake } from "@/integration/cube-fake";
import {
  type TDashboardsFixture,
  apiKeyOf,
  outcomeOf,
  seedDashboardsFixture,
  sessionOf,
} from "@/integration/dashboards-fixture";
import {
  type TMemoryRecord,
  runMemoryDimensionQuery,
} from "@/modules/ee/analysis/dashboards/lib/cube-memory-test-utils";
import {
  type TFilterSpec,
  toRequestFilters,
} from "@/modules/ee/analysis/dashboards/lib/dashboard-filter-rules";
import type {
  TDashboardFilter,
  TLockedDashboardFilter,
} from "@/modules/ee/analysis/dashboards/lib/dashboard-filters";
import { getV3DashboardChartData } from "./chart-data-operations";
import { listV3DashboardFilterValues } from "./filter-values-operations";
import { duplicateV3Dashboard, getV3Dashboard, replaceV3Dashboard } from "./operations";
import { type TV3DashboardResource, ZV3DashboardChartData, ZV3DashboardFilterValues } from "./resources";
import {
  ZV3DashboardChartDataQuery,
  ZV3DashboardFilterValuesQuery,
  ZV3DashboardReplaceBody,
} from "./schemas";

/**
 * Dashboard filters and the dashboard-bound reads (ENG-6898, ENG-6900, ENG-6904, ENG-6927) against real
 * PostgreSQL and SpiceDB, with Cube faked at its client boundary. Value lists are answered from in-memory
 * records with Cube's filter semantics, so "the list equals what the charts let through" is checked on
 * real rows, not on the shape of a query.
 */

vi.mock("@cubejs-client/core", async (importOriginal) =>
  (await import("@/integration/cube-fake")).fakeCubeModule(await importOriginal())
);
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsDashboardsEnabled: vi.fn(async () => true),
}));

const SOURCE = "FeedbackRecords.sourceName";
const LANGUAGE = "FeedbackRecords.language";
const COUNTRY = "FeedbackRecords.metadataCountry";
// A categorical field with a value lookup: only those, and embedded data, pick from a list (D1).
const ACCOUNT = "FeedbackRecords.fieldLabel";
const FREE_TEXT = "FeedbackRecords.valueText";
const COLLECTED_AT = "FeedbackRecords.collectedAt";

let fixture: TDashboardsFixture;
let secondDatasetId = "";
let unreadableDatasetId = "";
let sequence = 0;

const filterId = (n: number) => `clfi${String(n).padStart(21, "0")}`;
/** A filter an editor locks on the dashboard, saved with its values. */
const filterOf = (
  n: number,
  field: string,
  operator: TDashboardFilter["operator"] = "equals",
  values: string[] = ["en"]
): TLockedDashboardFilter => ({
  id: filterId(n),
  field,
  operator,
  label: `Filter ${n}`,
  values,
});

/** A read's own filters as query parameters: `filter[f1]=<operator>:<field>` and `picks[f1]=<value>`, … */
const requestFilters = (specs: TFilterSpec[]): Record<string, string | string[]> => {
  const { rules, picks } = toRequestFilters(specs);
  return {
    ...Object.fromEntries(Object.entries(rules).map(([id, rule]) => [`filter[${id}]`, rule])),
    ...Object.fromEntries(Object.entries(picks).map(([id, values]) => [`picks[${id}]`, values])),
  };
};

const ctx = (userId?: string) => ({
  authentication: sessionOf(userId ?? fixture.users.editor),
  requestId: "req",
  instance: "/api/v3/dashboards",
});

const createChart = (query: TChartQuery, datasetId = fixture.datasetId) =>
  prisma.chart.create({
    data: {
      name: `Chart ${++sequence}`,
      type: "bar",
      workspaceId: fixture.workspaceId,
      feedbackDirectoryId: datasetId,
      query,
      config: {},
    },
    select: { id: true },
  });

/** A dashboard holding `charts` side by side, with `filters` locked on it. */
const createDashboard = async (chartIds: string[], filters: TLockedDashboardFilter[] = []) =>
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

const readData = (
  dashboardId: string,
  chartId: string,
  params: Record<string, string | string[]> = {},
  userId?: string
) =>
  getV3DashboardChartData({
    dashboardId,
    chartId,
    query: ZV3DashboardChartDataQuery.parse(params),
    ...ctx(userId),
  });

const readValues = (
  dashboardId: string,
  id: string,
  params: Record<string, string | string[]> = {},
  userId?: string
) =>
  listV3DashboardFilterValues({
    dashboardId,
    filterId: id,
    query: ZV3DashboardFilterValuesQuery.parse(params),
    ...ctx(userId),
  });

const dataOf = async (response: Response) => ZV3DashboardChartData.parse((await response.json()).data);
const valuesOf = async (response: Response) =>
  ZV3DashboardFilterValues.parse((await response.json()).data).values.map((v) => v.value);

/** Records per Feedback Dataset, answering value-list queries the way Cube would. */
let records: Record<string, TMemoryRecord[]> = {};
const answerFromRecords = () => {
  cubeFake.respond = ({ claims, query }) =>
    (query.measures ?? []).length === 0
      ? runMemoryDimensionQuery(records[String(claims.tenantId)] ?? [], query as TChartQuery)
      : [];
};

beforeAll(async () => {
  fixture = await seedDashboardsFixture();
  const second = await prisma.feedbackDirectory.create({
    data: {
      name: "Second dataset",
      organizationId: fixture.organizationId,
      workspaces: { create: { workspaceId: fixture.workspaceId } },
    },
  });
  secondDatasetId = second.id;
  unreadableDatasetId = fixture.unassignedDatasetId;
  await synchronizeAuthzedIntegrationFixture();
}, 120_000);

beforeEach(() => {
  resetCubeFake();
  records = {};
});

afterEach(() => resetCubeFake());

describe("saving dashboard filters (ENG-6900)", () => {
  test("saves filters with their values in order with the one-call save, reads them back, and keeps them on a save without", async () => {
    const chart = await createChart({ measures: ["FeedbackRecords.count"] });
    const dashboard = await createDashboard([chart.id]);
    const filters = [
      filterOf(2, LANGUAGE),
      filterOf(1, SOURCE, "notEquals", ["Web", "App"]),
      filterOf(3, ACCOUNT, "contains", ["acme"]),
    ];

    const saved = await replaceV3Dashboard({
      dashboardId: dashboard.id,
      body: ZV3DashboardReplaceBody.parse({
        name: "Filtered",
        expectedUpdatedAt: dashboard.updatedAt.toISOString(),
        filters,
        widgets: [],
      }),
      ...ctx(),
    });
    expect(saved.status).toBe(200);
    const { data } = (await saved.json()) as { data: TV3DashboardResource };
    expect(data.filters).toEqual(filters);

    const read = (await (
      await getV3Dashboard({ dashboardId: dashboard.id, ...ctx(fixture.users.viewer) })
    ).json()) as {
      data: TV3DashboardResource;
    };
    expect(read.data.filters).toEqual(filters);

    const renamed = await replaceV3Dashboard({
      dashboardId: dashboard.id,
      body: ZV3DashboardReplaceBody.parse({
        name: "Renamed",
        expectedUpdatedAt: data.updatedAt,
        widgets: [],
      }),
      ...ctx(),
    });
    expect(((await renamed.json()) as { data: TV3DashboardResource }).data.filters).toEqual(filters);
  });

  test("a new dashboard has no filters", async () => {
    const dashboard = await createDashboard([]);
    const read = (await (await getV3Dashboard({ dashboardId: dashboard.id, ...ctx() })).json()) as {
      data: TV3DashboardResource;
    };
    expect(read.data.filters).toEqual([]);
  });

  test("refuses a stale save and leaves the filters as they were", async () => {
    const dashboard = await createDashboard([], [filterOf(1, LANGUAGE)]);
    const stale = new Date(dashboard.updatedAt.getTime() - 60_000).toISOString();

    const response = await replaceV3Dashboard({
      dashboardId: dashboard.id,
      body: ZV3DashboardReplaceBody.parse({ name: "x", expectedUpdatedAt: stale, filters: [], widgets: [] }),
      ...ctx(),
    });

    expect(await outcomeOf(response)).toEqual({ status: 409, code: "conflict" });
    const row = await prisma.dashboard.findUniqueOrThrow({ where: { id: dashboard.id } });
    expect(row.filters).toEqual([filterOf(1, LANGUAGE)]);
  });

  test("takes exactly 10 filters and refuses an 11th, an unknown field, a repeated id and no values before saving", () => {
    const body = (filters: unknown[]) => ({
      name: "Board",
      expectedUpdatedAt: new Date().toISOString(),
      filters,
      widgets: [],
    });
    const ten = Array.from({ length: 10 }, (_, i) => filterOf(i + 1, SOURCE));
    expect(ZV3DashboardReplaceBody.safeParse(body(ten)).success).toBe(true);
    expect(ZV3DashboardReplaceBody.safeParse(body([...ten, filterOf(11, SOURCE)])).success).toBe(false);
    expect(ZV3DashboardReplaceBody.safeParse(body([filterOf(1, "FeedbackRecords.nope")])).success).toBe(
      false
    );
    expect(
      ZV3DashboardReplaceBody.safeParse(body([filterOf(1, SOURCE), filterOf(1, LANGUAGE)])).success
    ).toBe(false);
    // A locked filter applies its values to every read, so it cannot be saved without any.
    expect(ZV3DashboardReplaceBody.safeParse(body([filterOf(1, SOURCE, "equals", [])])).success).toBe(false);
  });

  test("a copy of the dashboard keeps its filters", async () => {
    const dashboard = await createDashboard([], [filterOf(1, LANGUAGE)]);
    const response = await duplicateV3Dashboard({ dashboardId: dashboard.id, body: {}, ...ctx() });
    expect(response.status).toBe(201);
    expect(((await response.json()) as { data: TV3DashboardResource }).data.filters).toEqual([
      filterOf(1, LANGUAGE),
    ]);
  });
});

describe("GET /api/v3/dashboards/{dashboardId}/charts/{chartId}/data (ENG-6898, ENG-6904)", () => {
  test("reads a widget's data for anyone who may read the dashboard, as the chart data route does", async () => {
    const chart = await createChart({ measures: ["FeedbackRecords.count"], dimensions: [SOURCE] });
    const dashboard = await createDashboard([chart.id]);
    cubeFake.rows = [{ [SOURCE]: "Web", "FeedbackRecords.count": "3" }];

    for (const auth of [sessionOf(fixture.users.viewer), apiKeyOf(fixture, "readKey")]) {
      const response = await getV3DashboardChartData({
        dashboardId: dashboard.id,
        chartId: chart.id,
        query: {},
        authentication: auth,
        requestId: "req",
        instance: "/",
      });
      expect(response.status).toBe(200);
      const data = await dataOf(response);
      expect(data.rows).toEqual([{ [SOURCE]: "Web", "FeedbackRecords.count": 3 }]);
      expect(data.unfilterableFilters).toEqual([]);
    }
    expect(cubeFake.calls[0].claims.source).toBe("v3.dashboards.chartData");
  });

  test("answers the same 404 for a chart on another dashboard and for one that does not exist", async () => {
    const onBoard = await createChart({ measures: ["FeedbackRecords.count"] });
    const elsewhere = await createChart({ measures: ["FeedbackRecords.count"] });
    const dashboard = await createDashboard([onBoard.id]);
    await createDashboard([elsewhere.id]);

    const other = await readData(dashboard.id, elsewhere.id);
    const unknown = await readData(dashboard.id, "clch999999999999999999999");
    expect(await outcomeOf(other)).toEqual({ status: 404, code: "not_found" });
    expect(await outcomeOf(unknown)).toEqual({ status: 404, code: "not_found" });
    const strip = (body: { details?: { resource_id?: string } }) => ({
      ...body,
      details: { ...body.details, resource_id: null },
    });
    expect(strip(await other.json())).toEqual(strip(await unknown.json()));
    expect(cubeFake.calls).toHaveLength(0);
  });

  test("refuses an outsider and an unknown dashboard with 403, and a chart on a dataset the caller cannot read", async () => {
    const chart = await createChart({ measures: ["FeedbackRecords.count"] });
    const dashboard = await createDashboard([chart.id]);
    expect(await outcomeOf(await readData(dashboard.id, chart.id, {}, fixture.users.outsider))).toEqual({
      status: 403,
      code: "forbidden",
    });
    expect((await readData("cldb999999999999999999999", chart.id)).status).toBe(403);

    const hidden = await createChart({ measures: ["FeedbackRecords.count"] }, unreadableDatasetId);
    const withHidden = await createDashboard([hidden.id]);
    expect((await readData(withHidden.id, hidden.id)).status).toBe(403);
    expect(cubeFake.calls).toHaveLength(0);
  });

  test("ANDs a request's filter onto a saved top-level rule on the same field, keeping the saved rule", async () => {
    const saved = { member: SOURCE, operator: "equals", values: ["Web", "Email"] };
    const chart = await createChart({ measures: ["FeedbackRecords.count"], filters: [saved] });
    const dashboard = await createDashboard([chart.id]);

    const response = await readData(
      dashboard.id,
      chart.id,
      requestFilters([{ field: SOURCE, operator: "equals", values: ["App"] }])
    );
    expect(response.status).toBe(200);

    expect(cubeFake.calls[0].query.filters).toEqual(
      expect.arrayContaining([saved, { member: SOURCE, operator: "equals", values: ["App"] }])
    );
  });

  test("keeps a nested saved OR group whole and ANDs every request filter beside it", async () => {
    const nested = {
      or: [
        { member: LANGUAGE, operator: "equals", values: ["en"] },
        {
          and: [
            { member: SOURCE, operator: "equals", values: ["Web"] },
            { member: COUNTRY, operator: "set" },
          ],
        },
      ],
    };
    const chart = await createChart({ measures: ["FeedbackRecords.count"], filters: [nested] });
    const dashboard = await createDashboard([chart.id]);

    await readData(
      dashboard.id,
      chart.id,
      requestFilters([
        { field: SOURCE, operator: "equals", values: ["Web", "App"] },
        { field: LANGUAGE, operator: "equals", values: ["de"] },
      ])
    );

    const sent = cubeFake.calls[0].query.filters ?? [];
    expect(sent).toContainEqual(nested);
    expect(sent).toContainEqual({ member: SOURCE, operator: "equals", values: ["Web", "App"] });
    expect(sent).toContainEqual({ member: LANGUAGE, operator: "equals", values: ["de"] });
  });

  test("the requested date range replaces the saved one, even where the two do not overlap", async () => {
    const chart = await createChart({
      measures: ["FeedbackRecords.count"],
      timeDimensions: [
        { dimension: COLLECTED_AT, granularity: "day", dateRange: ["2026-01-01", "2026-01-31"] },
      ],
    });
    const dashboard = await createDashboard([chart.id]);

    await readData(dashboard.id, chart.id, { from: "2026-01-20", to: "2026-03-01" });
    expect(cubeFake.calls[0].query.timeDimensions?.[0].dateRange).toEqual(["2026-01-20", "2026-03-01"]);

    const disjoint = await readData(dashboard.id, chart.id, { from: "2026-02-01", to: "2026-02-28" });
    expect(disjoint.status).toBe(200);
    expect(cubeFake.calls).toHaveLength(2);
    expect(cubeFake.calls[1].query.timeDimensions?.[0].dateRange).toEqual(["2026-02-01", "2026-02-28"]);
  });

  test("answers an empty chart naming the filter when the dataset lacks a picked field, and ignores unpicked ones", async () => {
    const chart = await createChart({ measures: ["FeedbackRecords.count"] });
    const dashboard = await createDashboard([chart.id]);
    const missing = "FeedbackRecords.ed_area_manager";

    const unpicked = await readData(
      dashboard.id,
      chart.id,
      requestFilters([
        { field: SOURCE, operator: "equals", values: ["Web"] },
        { field: missing, operator: "equals" },
      ])
    );
    expect((await dataOf(unpicked)).unfilterableFilters).toEqual([]);

    const picked = await readData(
      dashboard.id,
      chart.id,
      requestFilters([
        { field: SOURCE, operator: "equals" },
        { field: missing, operator: "equals", values: ["Bianchi"] },
      ])
    );
    const data = await dataOf(picked);
    expect(data.rows).toEqual([]);
    // A request's filter has no label of its own: it is named by its field.
    expect(data.unfilterableFilters).toEqual([{ id: "f2", label: missing }]);
    expect(cubeFake.calls).toHaveLength(1);
  });

  test("ignores a pick for a filter the request does not name", async () => {
    const chart = await createChart({ measures: ["FeedbackRecords.count"] });
    const dashboard = await createDashboard([chart.id]);

    await readData(dashboard.id, chart.id, { "picks[f1]": "Web" });
    expect(cubeFake.calls[0].query.filters ?? []).toEqual([]);
  });

  test("refuses a request filter on a field outside the catalog without asking Cube", async () => {
    const chart = await createChart({ measures: ["FeedbackRecords.count"] });
    const dashboard = await createDashboard([chart.id]);

    const response = await readData(dashboard.id, chart.id, {
      "filter[f1]": "equals:FeedbackRecords.nope",
      "picks[f1]": "x",
    });
    expect(await outcomeOf(response)).toEqual({ status: 422, code: "unprocessable_content" });
    expect(cubeFake.calls).toHaveLength(0);
  });
});

describe("filters locked on the dashboard (ENG-6900)", () => {
  test("narrow every chart read, a viewer's included, under the request's own filters", async () => {
    const chart = await createChart({ measures: ["FeedbackRecords.count"] });
    const dashboard = await createDashboard([chart.id], [filterOf(1, SOURCE, "equals", ["Web"])]);

    expect((await readData(dashboard.id, chart.id, {}, fixture.users.viewer)).status).toBe(200);
    expect(cubeFake.calls[0].query.filters).toEqual([
      { member: SOURCE, operator: "equals", values: ["Web"] },
    ]);

    await readData(
      dashboard.id,
      chart.id,
      requestFilters([{ field: LANGUAGE, operator: "equals", values: ["de"] }]),
      fixture.users.viewer
    );
    expect(cubeFake.calls[1].query.filters).toEqual([
      { member: SOURCE, operator: "equals", values: ["Web"] },
      { member: LANGUAGE, operator: "equals", values: ["de"] },
    ]);
  });

  test("cannot be replaced by a request filter of the same field: both apply", async () => {
    const chart = await createChart({ measures: ["FeedbackRecords.count"] });
    const dashboard = await createDashboard([chart.id], [filterOf(1, SOURCE, "equals", ["Web"])]);

    await readData(
      dashboard.id,
      chart.id,
      requestFilters([{ field: SOURCE, operator: "equals", values: ["App"] }])
    );
    expect(cubeFake.calls[0].query.filters).toEqual([
      { member: SOURCE, operator: "equals", values: ["Web"] },
      { member: SOURCE, operator: "equals", values: ["App"] },
    ]);
  });

  test("answer an empty chart naming the saved label when the dataset lacks the locked field", async () => {
    const chart = await createChart({ measures: ["FeedbackRecords.count"] });
    const missing: TLockedDashboardFilter = {
      id: filterId(9),
      field: "FeedbackRecords.ed_area_manager",
      operator: "equals",
      label: "Area Manager",
      values: ["Bianchi"],
    };
    const dashboard = await createDashboard([chart.id], [missing]);

    const data = await dataOf(await readData(dashboard.id, chart.id, {}, fixture.users.viewer));
    expect(data.rows).toEqual([]);
    expect(data.unfilterableFilters).toEqual([{ id: "locked.0", label: "Area Manager" }]);
    expect(cubeFake.calls).toHaveLength(0);
  });

  test("narrow a value list for a viewer as they narrow the charts", async () => {
    records[fixture.datasetId] = [
      { [ACCOUNT]: "it", [COUNTRY]: "IT" },
      { [ACCOUNT]: "de", [COUNTRY]: "DE" },
    ];
    const chart = await createChart({ measures: ["FeedbackRecords.count"] });
    const dashboard = await createDashboard([chart.id], [filterOf(1, COUNTRY, "equals", ["IT"])]);
    answerFromRecords();

    const response = await readValues(
      dashboard.id,
      "f1",
      requestFilters([{ field: ACCOUNT, operator: "equals" }]),
      fixture.users.viewer
    );
    expect(response.status).toBe(200);
    expect(await valuesOf(response)).toEqual(["it"]);
  });
});

describe("GET /api/v3/dashboards/{dashboardId}/filters/{filterId}/values (ENG-6927)", () => {
  // The read names its own filters: "account" is the one whose values are listed, "country" narrows it.
  const RULES = {
    "filter[account]": `equals:${ACCOUNT}`,
    "filter[country]": `equals:${COUNTRY}`,
  };

  test("equals the union of what each chart lets through, and never a value outside every chart's rules", async () => {
    // Chart 1 lets country IT through; chart 2 lets source Web through. "leak" is DE + App: each of its
    // fields passes one chart's rule, the record passes neither.
    records[fixture.datasetId] = [
      { [ACCOUNT]: "it-app", [COUNTRY]: "IT", [SOURCE]: "App" },
      { [ACCOUNT]: "de-web", [COUNTRY]: "DE", [SOURCE]: "Web" },
      { [ACCOUNT]: "leak", [COUNTRY]: "DE", [SOURCE]: "App" },
    ];
    const one = await createChart({
      measures: ["FeedbackRecords.count"],
      filters: [{ member: COUNTRY, operator: "equals", values: ["IT"] }],
    });
    const two = await createChart({
      measures: ["FeedbackRecords.count"],
      filters: [{ member: SOURCE, operator: "equals", values: ["Web"] }],
    });
    const dashboard = await createDashboard([one.id, two.id], []);
    answerFromRecords();

    const response = await readValues(dashboard.id, "account", RULES);

    expect(response.status).toBe(200);
    expect(await valuesOf(response)).toEqual(["de-web", "it-app"]);
    expect(cubeFake.calls).toHaveLength(1);
    expect(cubeFake.calls[0].claims.source).toBe("v3.dashboards.filterValues");
  });

  test("asks one query per dataset, merges them, and leaves out a dataset missing another picked field", async () => {
    records[fixture.datasetId] = [{ [ACCOUNT]: "a1", [COUNTRY]: "IT" }];
    records[secondDatasetId] = [
      { [ACCOUNT]: "b1", [COUNTRY]: "IT" },
      { [ACCOUNT]: "b2", [COUNTRY]: "DE" },
    ];
    const one = await createChart({ measures: ["FeedbackRecords.count"] });
    const two = await createChart({ measures: ["FeedbackRecords.count"] }, secondDatasetId);
    const dashboard = await createDashboard([one.id, two.id], []);
    answerFromRecords();

    expect(await valuesOf(await readValues(dashboard.id, "account", RULES))).toEqual(["a1", "b1", "b2"]);
    expect(cubeFake.calls).toHaveLength(2);

    expect(
      await valuesOf(await readValues(dashboard.id, "account", { ...RULES, "picks[country]": "IT" }))
    ).toEqual(["a1", "b1"]);
    // Its own pick never narrows it.
    expect(
      await valuesOf(await readValues(dashboard.id, "account", { ...RULES, "picks[account]": "a1" }))
    ).toEqual(["a1", "b1", "b2"]);
  });

  test("lists 100 of 20,000 values with hasMore, and narrows them with search", async () => {
    records[fixture.datasetId] = Array.from({ length: 20_000 }, (_, i) => ({
      [ACCOUNT]: `account-${String(i).padStart(5, "0")}`,
    }));
    const chart = await createChart({ measures: ["FeedbackRecords.count"] });
    const dashboard = await createDashboard([chart.id]);
    answerFromRecords();

    const all = ZV3DashboardFilterValues.parse(
      (await (await readValues(dashboard.id, "account", RULES)).json()).data
    );
    expect(all.values).toHaveLength(100);
    expect(all.hasMore).toBe(true);

    const searched = ZV3DashboardFilterValues.parse(
      (await (await readValues(dashboard.id, "account", { ...RULES, search: "ACCOUNT-1999" })).json()).data
    );
    expect(searched.values.map((v) => v.value)).toEqual(
      Array.from({ length: 10 }, (_, i) => `account-1999${i}`)
    );
    expect(searched.hasMore).toBe(false);
  });

  test("answers a repeated ask from the cache without Cube, and asks again for other picks", async () => {
    records[fixture.datasetId] = [{ [ACCOUNT]: "a", [COUNTRY]: "IT" }];
    const chart = await createChart({ measures: ["FeedbackRecords.count"] });
    const dashboard = await createDashboard([chart.id], []);
    answerFromRecords();

    await readValues(dashboard.id, "account", RULES);
    await readValues(dashboard.id, "account", RULES, fixture.users.viewer);
    expect(cubeFake.calls).toHaveLength(1);

    await readValues(dashboard.id, "account", { ...RULES, "picks[country]": "IT" });
    expect(cubeFake.calls).toHaveLength(2);
  });

  test("answers 422 for a filter the request does not name and for one that takes a typed value", async () => {
    const chart = await createChart({ measures: ["FeedbackRecords.count"] });
    const dashboard = await createDashboard([chart.id]);
    const params = {
      "filter[typed]": `contains:${ACCOUNT}`,
      // Free text with equals is still typed: listing it would hand readers every record's text (D1).
      "filter[free]": `equals:${FREE_TEXT}`,
    };

    for (const id of ["free", "unnamed", "typed"]) {
      expect(await outcomeOf(await readValues(dashboard.id, id, params))).toEqual({
        status: 422,
        code: "unprocessable_content",
      });
    }
    expect(cubeFake.calls).toHaveLength(0);
  });

  test("asks Cube again once a widget's chart is edited, though the dashboard is not (S7)", async () => {
    records[fixture.datasetId] = [{ [ACCOUNT]: "a", [COUNTRY]: "IT" }];
    const chart = await createChart({ measures: ["FeedbackRecords.count"] });
    const dashboard = await createDashboard([chart.id]);
    answerFromRecords();

    await readValues(dashboard.id, "account", RULES);
    await prisma.chart.update({
      where: { id: chart.id },
      data: {
        query: {
          measures: ["FeedbackRecords.count"],
          filters: [{ member: COUNTRY, operator: "equals", values: ["DE"] }],
        },
      },
    });
    const after = await readValues(dashboard.id, "account", RULES);

    expect(cubeFake.calls).toHaveLength(2);
    expect(await valuesOf(after)).toEqual([]);
  });

  test("lists only the groups a top-N chart shows (S6)", async () => {
    records[fixture.datasetId] = [
      { [ACCOUNT]: "a", [COUNTRY]: "IT" },
      { [ACCOUNT]: "b", [COUNTRY]: "DE" },
    ];
    const topOne = await createChart({
      measures: ["FeedbackRecords.count"],
      dimensions: [ACCOUNT],
      order: [["FeedbackRecords.count", "desc"]],
      limit: 1,
    });
    const dashboard = await createDashboard([topOne.id]);
    // The chart's own query is answered with its one shown group.
    cubeFake.respond = ({ query }) =>
      (query.measures ?? []).length > 0 ? [{ [ACCOUNT]: "b", "FeedbackRecords.count": 1 }] : [];

    const response = await readValues(dashboard.id, "account", RULES);

    expect(await valuesOf(response)).toEqual(["b"]);
    expect(cubeFake.calls).toHaveLength(1);
  });

  test("answers an empty list without Cube for a dashboard with no charts, and refuses an outsider", async () => {
    const dashboard = await createDashboard([]);
    const response = await readValues(dashboard.id, "account", RULES);
    expect(ZV3DashboardFilterValues.parse((await response.json()).data)).toEqual({
      values: [],
      hasMore: false,
    });
    expect(cubeFake.calls).toHaveLength(0);

    expect((await readValues(dashboard.id, "account", RULES, fixture.users.outsider)).status).toBe(403);
  });
});
