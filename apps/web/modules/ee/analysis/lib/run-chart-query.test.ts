import { beforeEach, describe, expect, test, vi } from "vitest";
import { executeTenantScopedQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import { resolveOptionGrouping } from "@/modules/ee/analysis/charts/lib/option-grouping";
import { getEmbeddedFieldMemberId } from "./embedded-data-fields";
import { getEmbeddedChartFields } from "./embedded-data-fields.server";
import { runChartQuery } from "./run-chart-query";

vi.mock("server-only", () => ({}));
vi.mock("@/modules/ee/analysis/api/lib/cube-client", () => ({ executeTenantScopedQuery: vi.fn() }));
vi.mock("./embedded-data-fields.server", () => ({ getEmbeddedChartFields: vi.fn() }));
vi.mock("@/modules/ee/analysis/charts/lib/option-grouping", () => ({
  resolveOptionGrouping: vi.fn(async (query: unknown) => ({ rewrittenQuery: query })),
  pruneChartLabels: vi.fn(() => ({})),
}));

const brand = getEmbeddedFieldMemberId("brand");
const plan = getEmbeddedFieldMemberId("plan");
const run = (query: Record<string, unknown>) =>
  runChartQuery({
    query,
    datasetId: "dir-1",
    workspaceId: "ws-1",
    organizationId: "org-1",
    actor: { type: "user", id: "user-1" },
    source: "v3.charts.preview",
  });

describe("runChartQuery Embedded Data labels (ENG-2848)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(executeTenantScopedQuery).mockResolvedValue([
      { [brand]: "Nordic", "FeedbackRecords.count": 3 },
    ]);
    vi.mocked(getEmbeddedChartFields).mockResolvedValue([
      { id: brand, name: "brand", type: "string", surveyNames: ["A"] },
      { id: plan, name: "plan", type: "string", surveyNames: ["A"] },
    ]);
  });

  test("names every Embedded Data member the query used, wherever it sits, and only those", async () => {
    const result = await run({
      measures: ["FeedbackRecords.count"],
      dimensions: [brand],
      filters: [{ member: brand, operator: "set" }],
    });

    expect(result.memberLabels).toEqual({ [brand]: "brand" });
    expect(getEmbeddedChartFields).toHaveBeenCalledWith("ws-1", "dir-1");
    expect(resolveOptionGrouping).toHaveBeenCalled();
  });

  test("adds no labels and makes no lookup for a query without Embedded Data", async () => {
    const result = await run({
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.sourceName"],
    });

    expect(result).not.toHaveProperty("memberLabels");
    expect(getEmbeddedChartFields).not.toHaveBeenCalled();
  });
});
