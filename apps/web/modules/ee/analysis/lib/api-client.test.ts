import { afterEach, describe, expect, test, vi } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  buildChartListSearchParams,
  chartInUseDashboards,
  createChart,
  createDashboard,
  deleteChart,
  deleteDashboard,
  duplicateChart,
  duplicateDashboard,
  generateChart,
  getChart,
  getChartApiErrorMessage,
  getChartData,
  getDashboard,
  isStaleDashboardError,
  listChartFieldValues,
  listCharts,
  listDashboards,
  previewChart,
  removeDashboardWidget,
  replaceDashboard,
  restoreDashboardWidget,
  toAppChart,
  updateChart,
} from "./api-client";

const resource = {
  id: "clch000000000000000000001",
  workspaceId: "clws000000000000000000001",
  datasetId: "clds000000000000000000001",
  name: "NPS",
  type: "bar" as const,
  query: { measures: ["FeedbackRecords.npsScore"] },
  config: { showLegend: true },
  creator: { name: "Ada" },
  dashboards: [{ id: "cldb000000000000000000001", name: "Event" }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("analysis api client", () => {
  test("maps the public chart onto the app's chart, renaming datasetId to the internal directory id", () => {
    expect(toAppChart(resource)).toEqual({
      id: resource.id,
      name: "NPS",
      type: "bar",
      query: resource.query,
      config: resource.config,
      feedbackDirectoryId: resource.datasetId,
      createdAt: new Date(resource.createdAt),
      updatedAt: new Date(resource.updatedAt),
      creator: { name: "Ada" },
      dashboards: resource.dashboards,
    });
  });

  test("builds the list query in v3's filter spelling and leaves out what is unset", () => {
    expect(
      buildChartListSearchParams({
        workspaceId: resource.workspaceId,
        limit: 25,
        cursor: "next",
        filters: { nameContains: "  nps ", datasetId: resource.datasetId },
      }).toString()
    ).toBe(
      new URLSearchParams({
        workspaceId: resource.workspaceId,
        limit: "25",
        cursor: "next",
        "filter[name][contains]": "nps",
        "filter[datasetId][eq]": resource.datasetId,
      }).toString()
    );
    expect(
      buildChartListSearchParams({ workspaceId: "w", limit: 1, filters: { nameContains: " " } }).toString()
    ).toBe("workspaceId=w&limit=1");
  });

  test("returns a page of app charts and throws the problem on failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: [resource], meta: { limit: 25, nextCursor: null } }));
    vi.stubGlobal("fetch", fetchMock);

    const page = await listCharts({ workspaceId: resource.workspaceId, limit: 25 });
    expect(page.data[0].feedbackDirectoryId).toBe(resource.datasetId);
    expect(page.meta.nextCursor).toBeNull();

    fetchMock.mockResolvedValueOnce(
      Response.json(
        { status: 403, title: "Forbidden", detail: "No", code: "dashboards_plan_required", requestId: "r" },
        { status: 403 }
      )
    );
    await expect(getChart(resource.id)).rejects.toMatchObject({
      constructor: V3ApiError,
      status: 403,
      code: "dashboards_plan_required",
    });
  });

  test("tells a stale save apart from a name clash, though both answer 409", () => {
    const conflict = (details?: Record<string, unknown>) =>
      new V3ApiError({ status: 409, detail: "Conflict", code: "conflict", details });

    expect(isStaleDashboardError(conflict({ currentUpdatedAt: "2026-10-22T11:30:00.000Z" }))).toBe(true);
    expect(isStaleDashboardError(conflict())).toBe(false);
    expect(isStaleDashboardError(new Error("network"))).toBe(false);
  });

  test("restores a removed widget at its old place, or in the first open slot once that is taken", async () => {
    const widget = {
      id: "clwidget00000000000000001",
      chartId: resource.id,
      layout: { x: 0, y: 0, w: 4, h: 4 },
      order: 0,
      chart: resource,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { status: 422, title: "Unprocessable", detail: "Overlaps", code: "unprocessable_content" },
          { status: 422 }
        )
      )
      .mockResolvedValueOnce(Response.json({ data: { ...widget, layout: { x: 4, y: 0, w: 4, h: 4 } } }));
    vi.stubGlobal("fetch", fetchMock);

    const restored = await restoreDashboardWidget("cldash0000000000000000001", widget);
    expect(restored.layout).toEqual({ x: 4, y: 0, w: 4, h: 4 });
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
    expect(bodies).toEqual([{ chartId: resource.id, layout: widget.layout }, { chartId: resource.id }]);
  });

  test("reads the dashboards a refused chart delete names, and nothing from any other error", () => {
    const inUse = new V3ApiError({
      status: 409,
      detail: "In use",
      code: "chart_in_use",
      details: { dashboards: [{ id: "d1", name: "Matchday" }, { id: 7 }] },
    });
    expect(chartInUseDashboards(inUse)).toEqual([{ id: "d1", name: "Matchday" }]);
    expect(
      chartInUseDashboards(new V3ApiError({ status: 409, detail: "Taken", code: "conflict" }))
    ).toBeNull();
    expect(chartInUseDashboards(new Error("network"))).toBeNull();
  });
});

describe("analysis api client requests", () => {
  const SPECIAL_ID = "a/b c";
  const ENCODED_ID = "a%2Fb%20c";

  const dashboardResource = {
    id: "cldb000000000000000000001",
    workspaceId: resource.workspaceId,
    name: "Matchday",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-03T10:00:00.123Z",
    widgets: [
      {
        id: "clwidget00000000000000001",
        chartId: resource.id,
        layout: { x: 0, y: 0, w: 4, h: 4 },
        order: 0,
        chart: resource,
      },
    ],
  };

  const chartData = {
    rows: [{ "FeedbackRecords.count": 3 }],
    optionLabels: {},
    fieldLabels: { "FeedbackRecords.count": "Responses" },
    query: { measures: ["FeedbackRecords.count"] },
  };

  /** A fetch that answers `{ data }` for every call; a fresh Response each time, since a body reads once. */
  const stubFetch = (data: unknown = resource, init?: ResponseInit) => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      init?.status && init.status >= 400 ? Response.json(data, init) : Response.json({ data }, init)
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };

  const callOf = (fetchMock: ReturnType<typeof stubFetch>, index = 0) => {
    const [url, init = {}] = fetchMock.mock.calls[index];
    return { url, init, body: init.body === undefined ? undefined : JSON.parse(init.body as string) };
  };

  test("reads a chart by its encoded id, without the cache", async () => {
    const fetchMock = stubFetch();
    const controller = new AbortController();

    const chart = await getChart(SPECIAL_ID, controller.signal);

    expect(chart.feedbackDirectoryId).toBe(resource.datasetId);
    const { url, init } = callOf(fetchMock);
    expect(url).toBe(`/api/v3/charts/${ENCODED_ID}`);
    expect(init).toMatchObject({ cache: "no-store", signal: controller.signal });
  });

  test("passes the list's cursor and filters through and keeps the caller's signal", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ data: [], meta: { limit: 10, nextCursor: "c2" } })
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    const page = await listCharts({
      workspaceId: "w",
      limit: 10,
      cursor: "c1",
      filters: { datasetId: "d" },
      signal: controller.signal,
    });

    expect(page.meta.nextCursor).toBe("c2");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v3/charts?workspaceId=w&limit=10&cursor=c1&filter%5BdatasetId%5D%5Beq%5D=d");
    expect(init?.signal).toBe(controller.signal);
  });

  test("throws the parsed problem when the chart list is refused", async () => {
    stubFetch({ status: 403, detail: "No", code: "forbidden" }, { status: 403 });

    await expect(listCharts({ workspaceId: "w", limit: 10 })).rejects.toMatchObject({
      constructor: V3ApiError,
      status: 403,
      code: "forbidden",
    });
  });

  test("posts a preview without its signal in the body, and drops empty label maps", async () => {
    const fetchMock = stubFetch(chartData);
    const controller = new AbortController();

    const data = await previewChart({
      workspaceId: "w",
      datasetId: "d",
      type: "bar",
      query: { measures: ["FeedbackRecords.count"] },
      dateRange: { from: "2026-01-01", to: "2026-01-31" },
      signal: controller.signal,
    });

    expect(data).toEqual({
      rows: chartData.rows,
      optionLabels: undefined,
      fieldLabels: chartData.fieldLabels,
      query: chartData.query,
    });
    const { url, init, body } = callOf(fetchMock);
    expect(url).toBe("/api/v3/charts/preview");
    expect(init).toMatchObject({ method: "POST", signal: controller.signal });
    expect(body).toEqual({
      workspaceId: "w",
      datasetId: "d",
      type: "bar",
      query: { measures: ["FeedbackRecords.count"] },
      dateRange: { from: "2026-01-01", to: "2026-01-31" },
    });
  });

  test("creates a chart in a dataset and patches only what changed", async () => {
    const fetchMock = stubFetch();
    const chart = { name: "NPS", type: "bar" as const, query: resource.query, config: {} };

    await createChart({ workspaceId: "w", datasetId: "d", ...chart });
    await updateChart(SPECIAL_ID, { name: "Renamed" });

    expect(callOf(fetchMock, 0)).toMatchObject({
      url: "/api/v3/charts",
      init: { method: "POST", headers: { "Content-Type": "application/json" } },
      body: { workspaceId: "w", datasetId: "d", ...chart },
    });
    expect(callOf(fetchMock, 0).init.signal).toBeInstanceOf(AbortSignal);
    expect(callOf(fetchMock, 1)).toMatchObject({
      url: `/api/v3/charts/${ENCODED_ID}`,
      init: { method: "PATCH" },
      body: { name: "Renamed" },
    });
  });

  test("reads chart data for its own range, a preset, or a custom range", async () => {
    const fetchMock = stubFetch(chartData);

    await getChartData({ chartId: SPECIAL_ID });
    await getChartData({ chartId: SPECIAL_ID, dateRange: "last_7_days" });
    await getChartData({ chartId: SPECIAL_ID, dateRange: { from: "2026-01-01", to: "2026-01-31" } });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `/api/v3/charts/${ENCODED_ID}/data`,
      `/api/v3/charts/${ENCODED_ID}/data?dateRange=last_7_days`,
      `/api/v3/charts/${ENCODED_ID}/data?from=2026-01-01&to=2026-01-31`,
    ]);
  });

  test("looks up a field's values by its encoded name, with the search only when given", async () => {
    const fetchMock = stubFetch([{ value: "Speed", fieldType: "matrix" }]);

    const values = await listChartFieldValues({
      workspaceId: "w",
      datasetId: "d",
      field: "FeedbackRecords.field label",
      search: "sp&ed",
    });
    await listChartFieldValues({ workspaceId: "w", datasetId: "d", field: "x" });

    expect(values).toEqual([{ value: "Speed", fieldType: "matrix" }]);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/v3/charts/fields/FeedbackRecords.field%20label/values?workspaceId=w&datasetId=d&search=sp%26ed",
      "/api/v3/charts/fields/x/values?workspaceId=w&datasetId=d",
    ]);
  });

  test("lists dashboards with v3's filters and dates as Dates, and throws the problem on failure", async () => {
    const item = {
      id: dashboardResource.id,
      name: "Matchday",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: [item], meta: { limit: 5, nextCursor: null } }))
      .mockResolvedValueOnce(Response.json({ data: [], meta: { limit: 5, nextCursor: null } }))
      .mockResolvedValueOnce(
        Response.json({ status: 403, detail: "No", code: "dashboards_plan_required" }, { status: 403 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const page = await listDashboards({
      workspaceId: "w",
      limit: 5,
      cursor: "c1",
      filters: { nameContains: " match ", chartId: "ch" },
    });
    await listDashboards({ workspaceId: "w", limit: 5, filters: { nameContains: "  " } });

    expect(page.data[0].updatedAt).toEqual(new Date(item.updatedAt));
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/v3/dashboards?workspaceId=w&limit=5&cursor=c1&filter%5Bname%5D%5Bcontains%5D=match&filter%5BchartId%5D%5Beq%5D=ch",
      "/api/v3/dashboards?workspaceId=w&limit=5",
    ]);
    await expect(listDashboards({ workspaceId: "w", limit: 5 })).rejects.toMatchObject({
      status: 403,
      code: "dashboards_plan_required",
    });
  });

  test("reads a dashboard, keeping updatedAt as the server's string and mapping each widget's chart", async () => {
    const fetchMock = stubFetch(dashboardResource);

    const dashboard = await getDashboard(SPECIAL_ID);

    expect(callOf(fetchMock).url).toBe(`/api/v3/dashboards/${ENCODED_ID}`);
    expect(dashboard).toEqual({
      id: dashboardResource.id,
      workspaceId: resource.workspaceId,
      name: "Matchday",
      updatedAt: "2026-01-03T10:00:00.123Z",
      widgets: [
        {
          id: dashboardResource.widgets[0].id,
          dashboardId: dashboardResource.id,
          chartId: resource.id,
          layout: { x: 0, y: 0, w: 4, h: 4 },
          order: 0,
          chart: toAppChart(resource),
        },
      ],
    });
  });

  test("creates, replaces and duplicates dashboards with the right method, path and body", async () => {
    const fetchMock = stubFetch(dashboardResource);
    const replacement = {
      name: "Renamed",
      updatedAt: dashboardResource.updatedAt,
      widgets: [{ widgetId: "wid", layout: { x: 0, y: 0, w: 2, h: 2 }, order: 0 }],
    };

    await createDashboard({ workspaceId: "w", name: "New" });
    await replaceDashboard(SPECIAL_ID, replacement);
    await duplicateDashboard(SPECIAL_ID);
    await duplicateDashboard(SPECIAL_ID, "Copy");

    expect([0, 1, 2, 3].map((index) => callOf(fetchMock, index))).toMatchObject([
      { url: "/api/v3/dashboards", init: { method: "POST" }, body: { workspaceId: "w", name: "New" } },
      { url: `/api/v3/dashboards/${ENCODED_ID}`, init: { method: "PUT" }, body: replacement },
      { url: `/api/v3/dashboards/${ENCODED_ID}/duplicate`, init: { method: "POST" }, body: {} },
      { url: `/api/v3/dashboards/${ENCODED_ID}/duplicate`, init: { method: "POST" }, body: { name: "Copy" } },
    ]);
  });

  test("deletes dashboards, widgets and charts by encoded path, and throws the problem on failure", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await deleteDashboard(SPECIAL_ID);
    await removeDashboardWidget(SPECIAL_ID, "w/1");
    await deleteChart(SPECIAL_ID);

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      [`/api/v3/dashboards/${ENCODED_ID}`, "DELETE"],
      [`/api/v3/dashboards/${ENCODED_ID}/widgets/w%2F1`, "DELETE"],
      [`/api/v3/charts/${ENCODED_ID}`, "DELETE"],
    ]);

    fetchMock.mockResolvedValueOnce(
      Response.json(
        { status: 409, detail: "In use", code: "chart_in_use", details: { dashboards: [] } },
        { status: 409 }
      )
    );
    await expect(deleteChart("c")).rejects.toMatchObject({ status: 409, code: "chart_in_use" });
  });

  test("rethrows a widget failure other than an overlap instead of retrying elsewhere", async () => {
    const fetchMock = stubFetch({ status: 403, detail: "No", code: "forbidden" }, { status: 403 });

    await expect(
      restoreDashboardWidget("d", { chartId: resource.id, layout: { x: 0, y: 0, w: 4, h: 4 } })
    ).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("duplicates a chart on its own, or onto a dashboard falling back to the first open slot", async () => {
    const layout = { x: 0, y: 0, w: 4, h: 4 };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: resource }))
      .mockResolvedValueOnce(
        Response.json({ status: 422, detail: "Overlaps", code: "unprocessable_content" }, { status: 422 })
      )
      .mockResolvedValueOnce(Response.json({ data: resource }));
    vi.stubGlobal("fetch", fetchMock);

    await duplicateChart(SPECIAL_ID);
    const copy = await duplicateChart(SPECIAL_ID, { dashboardId: "d", layout });

    expect(copy.id).toBe(resource.id);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(
      Array(3).fill(`/api/v3/charts/${ENCODED_ID}/duplicate`)
    );
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string))).toEqual([
      {},
      { dashboardId: "d", layout },
      { dashboardId: "d" },
    ]);
  });

  test("generates a chart from the internal route with the prompt and the caller's signal", async () => {
    const generated = { chartType: "bar", query: resource.query, data: [] };
    const fetchMock = stubFetch(generated);
    const controller = new AbortController();

    const result = await generateChart({
      workspaceId: "w",
      datasetId: "d",
      prompt: "responses by source",
      signal: controller.signal,
    });

    expect(result).toEqual(generated);
    expect(callOf(fetchMock)).toMatchObject({
      url: "/api/internal/charts/generate",
      init: { method: "POST", signal: controller.signal },
      body: { workspaceId: "w", datasetId: "d", prompt: "responses by source" },
    });
  });

  test("reads an empty list from a chart-in-use problem whose dashboards are missing", () => {
    expect(
      chartInUseDashboards(new V3ApiError({ status: 409, detail: "In use", code: "chart_in_use" }))
    ).toEqual([]);
  });
});

describe("getChartApiErrorMessage", () => {
  test("adds the first refused field's reason to the problem's detail", () => {
    const error = new V3ApiError({
      status: 400,
      detail: "The chart query is not valid.",
      invalid_params: [
        { name: "query.measures[0]", reason: "Unknown field." },
        { name: "query.limit", reason: "Too large." },
      ],
    });
    expect(getChartApiErrorMessage(error, "fallback")).toBe("The chart query is not valid. Unknown field.");
  });

  test("uses the detail alone, or the fallback when the problem has none", () => {
    expect(getChartApiErrorMessage(new V3ApiError({ status: 403, detail: "Forbidden." }), "fb")).toBe(
      "Forbidden."
    );
    expect(getChartApiErrorMessage(new V3ApiError({ status: 500, detail: "" }), "fb")).toBe("fb");
  });

  test("uses a plain error's message, and the fallback for anything without one", () => {
    expect(getChartApiErrorMessage(new Error("Failed to fetch"), "fb")).toBe("Failed to fetch");
    expect(getChartApiErrorMessage(new Error(""), "fb")).toBe("fb");
    expect(getChartApiErrorMessage("boom", "fb")).toBe("fb");
  });
});
