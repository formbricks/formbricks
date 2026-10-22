import { afterEach, describe, expect, test, vi } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { buildChartListSearchParams, getChart, listCharts, toAppChart } from "./api-client";

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
});
