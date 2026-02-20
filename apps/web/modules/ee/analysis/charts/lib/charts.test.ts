import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";

vi.mock("server-only", () => ({}));

var mockTxChart: {
  // NOSONAR / test code
  findFirst: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

vi.mock("@formbricks/database", () => {
  const tx = {
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  mockTxChart = tx;
  return {
    prisma: {
      chart: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn((cb: any) => cb({ chart: tx })),
    },
  };
});

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

const mockChartId = "chart-abc-123";
const mockProjectId = "project-abc-123";
const mockUserId = "user-abc-123";

const selectChart = {
  id: true,
  name: true,
  type: true,
  query: true,
  config: true,
  createdAt: true,
  updatedAt: true,
};

const mockChart = {
  id: mockChartId,
  name: "Test Chart",
  type: "bar",
  query: { measures: ["Responses.count"] },
  config: { showLegend: true },
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

const makePrismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("mock error", { code, clientVersion: "5.0.0" });

describe("Chart Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createChart", () => {
    test("creates a chart successfully", async () => {
      vi.mocked(prisma.chart.create).mockResolvedValue(mockChart as any);
      const { createChart } = await import("./charts");

      const result = await createChart({
        projectId: mockProjectId,
        name: "Test Chart",
        type: "bar",
        query: { measures: ["Responses.count"] },
        config: { showLegend: true },
        createdBy: mockUserId,
      });

      expect(result).toEqual(mockChart);
      expect(prisma.chart.create).toHaveBeenCalledWith({
        data: {
          name: "Test Chart",
          type: "bar",
          projectId: mockProjectId,
          query: { measures: ["Responses.count"] },
          config: { showLegend: true },
          createdBy: mockUserId,
        },
        select: selectChart,
      });
    });

    test("throws InvalidInputError on unique constraint violation", async () => {
      vi.mocked(prisma.chart.create).mockRejectedValue(
        makePrismaError(PrismaErrorType.UniqueConstraintViolation)
      );
      const { createChart } = await import("./charts");

      await expect(
        createChart({
          projectId: mockProjectId,
          name: "Duplicate",
          type: "bar",
          query: {},
          config: {},
          createdBy: mockUserId,
        })
      ).rejects.toMatchObject({
        name: "InvalidInputError",
      });
    });

    test("throws DatabaseError on other Prisma errors", async () => {
      vi.mocked(prisma.chart.create).mockRejectedValue(makePrismaError("P9999"));
      const { createChart } = await import("./charts");

      await expect(
        createChart({
          projectId: mockProjectId,
          name: "Test",
          type: "bar",
          query: {},
          config: {},
          createdBy: mockUserId,
        })
      ).rejects.toMatchObject({
        name: "DatabaseError",
      });
    });
  });

  describe("updateChart", () => {
    test("updates a chart successfully", async () => {
      const updatedChart = { ...mockChart, name: "Updated Chart" };
      mockTxChart.findFirst.mockResolvedValue(mockChart);
      mockTxChart.update.mockResolvedValue(updatedChart);
      const { updateChart } = await import("./charts");

      const result = await updateChart(mockChartId, mockProjectId, { name: "Updated Chart" });

      expect(result).toEqual({ chart: mockChart, updatedChart });
      expect(mockTxChart.findFirst).toHaveBeenCalledWith({
        where: { id: mockChartId, projectId: mockProjectId },
        select: selectChart,
      });
      expect(mockTxChart.update).toHaveBeenCalledWith({
        where: { id: mockChartId },
        data: { name: "Updated Chart", type: undefined, query: undefined, config: undefined },
        select: selectChart,
      });
    });

    test("throws ResourceNotFoundError when chart does not exist", async () => {
      mockTxChart.findFirst.mockResolvedValue(null);
      const { updateChart } = await import("./charts");

      await expect(updateChart(mockChartId, mockProjectId, { name: "Updated" })).rejects.toMatchObject({
        name: "ResourceNotFoundError",
        resourceType: "Chart",
        resourceId: mockChartId,
      });
      expect(mockTxChart.update).not.toHaveBeenCalled();
    });

    test("throws InvalidInputError on unique constraint violation", async () => {
      mockTxChart.findFirst.mockResolvedValue(mockChart);
      mockTxChart.update.mockRejectedValue(makePrismaError(PrismaErrorType.UniqueConstraintViolation));
      vi.mocked(prisma.$transaction).mockImplementation((cb: any) => cb({ chart: mockTxChart }));
      const { updateChart } = await import("./charts");

      await expect(updateChart(mockChartId, mockProjectId, { name: "Taken Name" })).rejects.toMatchObject({
        name: "InvalidInputError",
      });
    });
  });

  describe("duplicateChart", () => {
    test("duplicates a chart with '(copy)' suffix", async () => {
      vi.mocked(prisma.chart.findFirst).mockResolvedValue(mockChart as any);
      vi.mocked(prisma.chart.findMany).mockResolvedValue([]);
      vi.mocked(prisma.chart.create).mockResolvedValue({ ...mockChart, name: "Test Chart (copy)" } as any);
      const { duplicateChart } = await import("./charts");

      await duplicateChart(mockChartId, mockProjectId, mockUserId);

      expect(prisma.chart.findFirst).toHaveBeenCalledWith({
        where: { id: mockChartId, projectId: mockProjectId },
        select: selectChart,
      });
      expect(prisma.chart.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: "Test Chart (copy)" }),
        select: selectChart,
      });
    });

    test("increments copy number when '(copy)' already exists", async () => {
      vi.mocked(prisma.chart.findFirst).mockResolvedValue(mockChart as any);
      vi.mocked(prisma.chart.findMany).mockResolvedValue([{ name: "Test Chart (copy)" }] as any);
      vi.mocked(prisma.chart.create).mockResolvedValue({
        ...mockChart,
        name: "Test Chart (copy 2)",
      } as any);
      const { duplicateChart } = await import("./charts");

      await duplicateChart(mockChartId, mockProjectId, mockUserId);

      expect(prisma.chart.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: "Test Chart (copy 2)" }),
        select: selectChart,
      });
    });

    test("finds next available copy number", async () => {
      vi.mocked(prisma.chart.findFirst).mockResolvedValue(mockChart as any);
      vi.mocked(prisma.chart.findMany).mockResolvedValue([
        { name: "Test Chart (copy)" },
        { name: "Test Chart (copy 2)" },
      ] as any);
      vi.mocked(prisma.chart.create).mockResolvedValue({
        ...mockChart,
        name: "Test Chart (copy 3)",
      } as any);
      const { duplicateChart } = await import("./charts");

      await duplicateChart(mockChartId, mockProjectId, mockUserId);

      expect(prisma.chart.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: "Test Chart (copy 3)" }),
        select: selectChart,
      });
    });

    test("strips existing copy suffix before generating new name", async () => {
      const chartWithCopy = { ...mockChart, name: "Test Chart (copy)" };
      vi.mocked(prisma.chart.findFirst).mockResolvedValue(chartWithCopy as any);
      vi.mocked(prisma.chart.findMany).mockResolvedValue([{ name: "Test Chart (copy)" }] as any);
      vi.mocked(prisma.chart.create).mockResolvedValue({
        ...mockChart,
        name: "Test Chart (copy 2)",
      } as any);
      const { duplicateChart } = await import("./charts");

      await duplicateChart(mockChartId, mockProjectId, mockUserId);

      expect(prisma.chart.findMany).toHaveBeenCalledWith({
        where: { projectId: mockProjectId, name: { startsWith: "Test Chart (copy" } },
        select: { name: true },
      });
    });

    test("throws ResourceNotFoundError when source chart does not exist", async () => {
      vi.mocked(prisma.chart.findFirst).mockResolvedValue(null);
      const { duplicateChart } = await import("./charts");

      await expect(duplicateChart(mockChartId, mockProjectId, mockUserId)).rejects.toMatchObject({
        name: "ResourceNotFoundError",
        resourceType: "Chart",
        resourceId: mockChartId,
      });
    });
  });

  describe("deleteChart", () => {
    test("deletes a chart successfully", async () => {
      mockTxChart.findFirst.mockResolvedValue(mockChart);
      mockTxChart.delete.mockResolvedValue(undefined);
      const { deleteChart } = await import("./charts");

      const result = await deleteChart(mockChartId, mockProjectId);

      expect(result).toEqual(mockChart);
      expect(mockTxChart.findFirst).toHaveBeenCalledWith({
        where: { id: mockChartId, projectId: mockProjectId },
        select: selectChart,
      });
      expect(mockTxChart.delete).toHaveBeenCalledWith({ where: { id: mockChartId } });
    });

    test("throws ResourceNotFoundError when chart does not exist", async () => {
      mockTxChart.findFirst.mockResolvedValue(null);
      const { deleteChart } = await import("./charts");

      await expect(deleteChart(mockChartId, mockProjectId)).rejects.toMatchObject({
        name: "ResourceNotFoundError",
        resourceType: "Chart",
        resourceId: mockChartId,
      });
      expect(mockTxChart.delete).not.toHaveBeenCalled();
    });

    test("throws DatabaseError on Prisma errors", async () => {
      mockTxChart.findFirst.mockRejectedValue(makePrismaError("P9999"));
      vi.mocked(prisma.$transaction).mockImplementation((cb: any) => cb({ chart: mockTxChart }));
      const { deleteChart } = await import("./charts");

      await expect(deleteChart(mockChartId, mockProjectId)).rejects.toMatchObject({
        name: "DatabaseError",
      });
    });
  });

  describe("getChart", () => {
    test("returns a chart successfully", async () => {
      vi.mocked(prisma.chart.findFirst).mockResolvedValue(mockChart as any);
      const { getChart } = await import("./charts");

      const result = await getChart(mockChartId, mockProjectId);

      expect(result).toEqual(mockChart);
      expect(prisma.chart.findFirst).toHaveBeenCalledWith({
        where: { id: mockChartId, projectId: mockProjectId },
        select: selectChart,
      });
    });

    test("throws ResourceNotFoundError when chart does not exist", async () => {
      vi.mocked(prisma.chart.findFirst).mockResolvedValue(null);
      const { getChart } = await import("./charts");

      await expect(getChart(mockChartId, mockProjectId)).rejects.toMatchObject({
        name: "ResourceNotFoundError",
        resourceType: "Chart",
        resourceId: mockChartId,
      });
    });

    test("throws DatabaseError on Prisma errors", async () => {
      vi.mocked(prisma.chart.findFirst).mockRejectedValue(makePrismaError("P9999"));
      const { getChart } = await import("./charts");

      await expect(getChart(mockChartId, mockProjectId)).rejects.toMatchObject({
        name: "DatabaseError",
      });
    });
  });

  describe("getCharts", () => {
    test("returns all charts for a project", async () => {
      const charts = [
        { ...mockChart, widgets: [{ dashboardId: "dash-1" }] },
        { ...mockChart, id: "chart-2", name: "Chart 2", widgets: [] },
      ];
      vi.mocked(prisma.chart.findMany).mockResolvedValue(charts as any);
      const { getCharts } = await import("./charts");

      const result = await getCharts(mockProjectId);

      expect(result).toEqual(charts);
      expect(prisma.chart.findMany).toHaveBeenCalledWith({
        where: { projectId: mockProjectId },
        orderBy: { createdAt: "desc" },
        select: expect.objectContaining({
          id: true,
          name: true,
          widgets: { select: { dashboardId: true } },
        }),
      });
    });

    test("returns empty array when no charts exist", async () => {
      vi.mocked(prisma.chart.findMany).mockResolvedValue([]);
      const { getCharts } = await import("./charts");

      const result = await getCharts(mockProjectId);

      expect(result).toEqual([]);
    });

    test("throws DatabaseError on Prisma errors", async () => {
      vi.mocked(prisma.chart.findMany).mockRejectedValue(makePrismaError("P9999"));
      const { getCharts } = await import("./charts");

      await expect(getCharts(mockProjectId)).rejects.toMatchObject({
        name: "DatabaseError",
      });
    });
  });
});
