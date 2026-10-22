import { afterEach, describe, expect, test, vi } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  buildChartListSearchParams,
  chartInUseDashboards,
  getChart,
  isStaleDashboardError,
  listCharts,
  restoreDashboardWidget,
  toAppChart,
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
