import { ChartType } from "@prisma/client";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TChartInput, TGetChartsFilter } from "@/modules/api/v2/management/charts/types/charts";
import { createChart, getCharts } from "../chart";

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    chart: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe("getCharts", () => {
  const projectIds = ["project1"];
  const params = {
    limit: 10,
    skip: 0,
  };
  const fakeCharts = [
    { id: "c1", projectId: "project1", name: "Chart One", type: "bar" },
    { id: "c2", projectId: "project1", name: "Chart Two", type: "line" },
  ];
  const count = fakeCharts.length;

  test("returns ok response with charts and meta", async () => {
    vi.mocked(prisma.$transaction).mockResolvedValueOnce([fakeCharts, count]);

    const result = await getCharts(projectIds, params as TGetChartsFilter);
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.data).toEqual(fakeCharts);
      expect(result.data.meta).toEqual({
        total: count,
        limit: params.limit,
        offset: params.skip,
      });
    }
  });

  test("returns error when prisma.$transaction throws", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error("Test error"));

    const result = await getCharts(projectIds, params as TGetChartsFilter);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toEqual("internal_server_error");
    }
  });
});

describe("createChart", () => {
  const inputChart: TChartInput = {
    projectId: "project1",
    name: "New Chart",
    type: "bar" as ChartType,
    query: { measures: ["Orders.count"] },
    config: {},
  };

  const createdChart = {
    id: "c100",
    projectId: inputChart.projectId,
    name: inputChart.name,
    type: inputChart.type,
    query: inputChart.query,
    config: inputChart.config,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  test("creates a chart", async () => {
    vi.mocked(prisma.chart.create).mockResolvedValueOnce(createdChart);

    const result = await createChart(inputChart);
    expect(prisma.chart.create).toHaveBeenCalled();
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data).toEqual(createdChart);
    }
  });

  test("returns conflict error on duplicate name", async () => {
    const { prismaUniqueConstraintError } = await import(
      "@/modules/api/v2/management/charts/[chartId]/lib/tests/mocks/chart.mock"
    );
    vi.mocked(prisma.chart.create).mockRejectedValueOnce(prismaUniqueConstraintError);

    const result = await createChart(inputChart);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.type).toEqual("conflict");
    }
  });

  test("returns error when creation fails", async () => {
    vi.mocked(prisma.chart.create).mockRejectedValueOnce(new Error("Creation failed"));

    const result = await createChart(inputChart);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.type).toEqual("internal_server_error");
    }
  });
});
