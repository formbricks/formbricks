import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";

vi.mock("server-only", () => ({}));

var mockTxDashboard: {
  // NOSONAR / test code
  findFirst: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

var mockTxChart: { findFirst: ReturnType<typeof vi.fn> }; // NOSONAR / test code

var mockTxWidget: {
  // NOSONAR / test code
  aggregate: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};

vi.mock("@formbricks/database", () => {
  const txDash = { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() };
  const txChart = { findFirst: vi.fn() };
  const txWidget = { aggregate: vi.fn(), create: vi.fn() };
  mockTxDashboard = txDash;
  mockTxChart = txChart;
  mockTxWidget = txWidget;
  return {
    prisma: {
      dashboard: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn((cb: any) => cb({ dashboard: txDash, chart: txChart, dashboardWidget: txWidget })),
    },
  };
});

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@/modules/ee/analysis/charts/lib/charts", () => ({
  selectChart: {
    id: true,
    name: true,
    type: true,
    query: true,
    config: true,
    createdAt: true,
    updatedAt: true,
  },
}));

const mockDashboardId = "dashboard-abc-123";
const mockProjectId = "project-abc-123";
const mockUserId = "user-abc-123";
const mockChartId = "chart-abc-123";

const selectDashboard = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
};

const mockDashboard = {
  id: mockDashboardId,
  name: "Test Dashboard",
  description: "A test dashboard",
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

const makePrismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("mock error", { code, clientVersion: "5.0.0" });

describe("Dashboard Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createDashboard", () => {
    test("creates a dashboard successfully", async () => {
      vi.mocked(prisma.dashboard.create).mockResolvedValue(mockDashboard as any);
      const { createDashboard } = await import("./dashboards");

      const result = await createDashboard({
        projectId: mockProjectId,
        name: "Test Dashboard",
        description: "A test dashboard",
        createdBy: mockUserId,
      });

      expect(result).toEqual(mockDashboard);
      expect(prisma.dashboard.create).toHaveBeenCalledWith({
        data: {
          name: "Test Dashboard",
          description: "A test dashboard",
          projectId: mockProjectId,
          createdBy: mockUserId,
        },
        select: selectDashboard,
      });
    });

    test("creates a dashboard without description", async () => {
      const dashboardNoDesc = { ...mockDashboard, description: undefined };
      vi.mocked(prisma.dashboard.create).mockResolvedValue(dashboardNoDesc as any);
      const { createDashboard } = await import("./dashboards");

      const result = await createDashboard({
        projectId: mockProjectId,
        name: "Test Dashboard",
        createdBy: mockUserId,
      });

      expect(result).toEqual(dashboardNoDesc);
      expect(prisma.dashboard.create).toHaveBeenCalledWith({
        data: {
          name: "Test Dashboard",
          description: undefined,
          projectId: mockProjectId,
          createdBy: mockUserId,
        },
        select: selectDashboard,
      });
    });

    test("throws InvalidInputError on unique constraint violation", async () => {
      vi.mocked(prisma.dashboard.create).mockRejectedValue(
        makePrismaError(PrismaErrorType.UniqueConstraintViolation)
      );
      const { createDashboard } = await import("./dashboards");

      await expect(
        createDashboard({
          projectId: mockProjectId,
          name: "Duplicate",
          createdBy: mockUserId,
        })
      ).rejects.toMatchObject({
        name: "InvalidInputError",
      });
    });

    test("throws DatabaseError on other Prisma errors", async () => {
      vi.mocked(prisma.dashboard.create).mockRejectedValue(makePrismaError("P9999"));
      const { createDashboard } = await import("./dashboards");

      await expect(
        createDashboard({
          projectId: mockProjectId,
          name: "Test",
          createdBy: mockUserId,
        })
      ).rejects.toMatchObject({
        name: "DatabaseError",
      });
    });
  });

  describe("updateDashboard", () => {
    test("updates a dashboard successfully", async () => {
      const updatedDashboard = { ...mockDashboard, name: "Updated Dashboard" };
      mockTxDashboard.findFirst.mockResolvedValue(mockDashboard);
      mockTxDashboard.update.mockResolvedValue(updatedDashboard);
      const { updateDashboard } = await import("./dashboards");

      const result = await updateDashboard(mockDashboardId, mockProjectId, { name: "Updated Dashboard" });

      expect(result).toEqual({ dashboard: mockDashboard, updatedDashboard });
      expect(mockTxDashboard.findFirst).toHaveBeenCalledWith({
        where: { id: mockDashboardId, projectId: mockProjectId },
        select: selectDashboard,
      });
      expect(mockTxDashboard.update).toHaveBeenCalledWith({
        where: { id: mockDashboardId },
        data: { name: "Updated Dashboard", description: undefined },
        select: selectDashboard,
      });
    });

    test("throws ResourceNotFoundError when dashboard does not exist", async () => {
      mockTxDashboard.findFirst.mockResolvedValue(null);
      const { updateDashboard } = await import("./dashboards");

      await expect(
        updateDashboard(mockDashboardId, mockProjectId, { name: "Updated" })
      ).rejects.toMatchObject({
        name: "ResourceNotFoundError",
        resourceType: "Dashboard",
        resourceId: mockDashboardId,
      });
      expect(mockTxDashboard.update).not.toHaveBeenCalled();
    });

    test("throws InvalidInputError on unique constraint violation", async () => {
      mockTxDashboard.findFirst.mockResolvedValue(mockDashboard);
      mockTxDashboard.update.mockRejectedValue(makePrismaError(PrismaErrorType.UniqueConstraintViolation));
      vi.mocked(prisma.$transaction).mockImplementation((cb: any) =>
        cb({ dashboard: mockTxDashboard, chart: mockTxChart, dashboardWidget: mockTxWidget })
      );
      const { updateDashboard } = await import("./dashboards");

      await expect(
        updateDashboard(mockDashboardId, mockProjectId, { name: "Taken Name" })
      ).rejects.toMatchObject({
        name: "InvalidInputError",
      });
    });
  });

  describe("deleteDashboard", () => {
    test("deletes a dashboard successfully", async () => {
      mockTxDashboard.findFirst.mockResolvedValue(mockDashboard);
      mockTxDashboard.delete.mockResolvedValue(undefined);
      const { deleteDashboard } = await import("./dashboards");

      const result = await deleteDashboard(mockDashboardId, mockProjectId);

      expect(result).toEqual(mockDashboard);
      expect(mockTxDashboard.findFirst).toHaveBeenCalledWith({
        where: { id: mockDashboardId, projectId: mockProjectId },
        select: selectDashboard,
      });
      expect(mockTxDashboard.delete).toHaveBeenCalledWith({ where: { id: mockDashboardId } });
    });

    test("throws ResourceNotFoundError when dashboard does not exist", async () => {
      mockTxDashboard.findFirst.mockResolvedValue(null);
      const { deleteDashboard } = await import("./dashboards");

      await expect(deleteDashboard(mockDashboardId, mockProjectId)).rejects.toMatchObject({
        name: "ResourceNotFoundError",
        resourceType: "Dashboard",
        resourceId: mockDashboardId,
      });
      expect(mockTxDashboard.delete).not.toHaveBeenCalled();
    });

    test("throws DatabaseError on Prisma errors", async () => {
      mockTxDashboard.findFirst.mockRejectedValue(makePrismaError("P9999"));
      vi.mocked(prisma.$transaction).mockImplementation((cb: any) =>
        cb({ dashboard: mockTxDashboard, chart: mockTxChart, dashboardWidget: mockTxWidget })
      );
      const { deleteDashboard } = await import("./dashboards");

      await expect(deleteDashboard(mockDashboardId, mockProjectId)).rejects.toMatchObject({
        name: "DatabaseError",
      });
    });
  });

  describe("getDashboard", () => {
    test("returns a dashboard with widgets", async () => {
      const dashboardWithWidgets = {
        ...mockDashboard,
        widgets: [
          {
            id: "widget-1",
            order: 0,
            chart: { id: mockChartId, name: "Chart 1", type: "bar" },
          },
        ],
      };
      vi.mocked(prisma.dashboard.findFirst).mockResolvedValue(dashboardWithWidgets as any);
      const { getDashboard } = await import("./dashboards");

      const result = await getDashboard(mockDashboardId, mockProjectId);

      expect(result).toEqual(dashboardWithWidgets);
      expect(prisma.dashboard.findFirst).toHaveBeenCalledWith({
        where: { id: mockDashboardId, projectId: mockProjectId },
        include: {
          widgets: {
            orderBy: { order: "asc" },
            include: {
              chart: {
                select: expect.objectContaining({ id: true, name: true, type: true }),
              },
            },
          },
        },
      });
    });

    test("throws ResourceNotFoundError when dashboard does not exist", async () => {
      vi.mocked(prisma.dashboard.findFirst).mockResolvedValue(null);
      const { getDashboard } = await import("./dashboards");

      await expect(getDashboard(mockDashboardId, mockProjectId)).rejects.toMatchObject({
        name: "ResourceNotFoundError",
        resourceType: "Dashboard",
        resourceId: mockDashboardId,
      });
    });

    test("throws DatabaseError on Prisma errors", async () => {
      vi.mocked(prisma.dashboard.findFirst).mockRejectedValue(makePrismaError("P9999"));
      const { getDashboard } = await import("./dashboards");

      await expect(getDashboard(mockDashboardId, mockProjectId)).rejects.toMatchObject({
        name: "DatabaseError",
      });
    });
  });

  describe("getDashboards", () => {
    test("returns all dashboards for a project", async () => {
      const dashboards = [
        { ...mockDashboard, _count: { widgets: 3 } },
        { ...mockDashboard, id: "dash-2", name: "Dashboard 2", _count: { widgets: 0 } },
      ];
      vi.mocked(prisma.dashboard.findMany).mockResolvedValue(dashboards as any);
      const { getDashboards } = await import("./dashboards");

      const result = await getDashboards(mockProjectId);

      expect(result).toEqual(dashboards);
      expect(prisma.dashboard.findMany).toHaveBeenCalledWith({
        where: { projectId: mockProjectId },
        orderBy: { createdAt: "desc" },
        select: expect.objectContaining({
          id: true,
          name: true,
          _count: { select: { widgets: true } },
        }),
      });
    });

    test("returns empty array when no dashboards exist", async () => {
      vi.mocked(prisma.dashboard.findMany).mockResolvedValue([]);
      const { getDashboards } = await import("./dashboards");

      const result = await getDashboards(mockProjectId);

      expect(result).toEqual([]);
    });

    test("throws DatabaseError on Prisma errors", async () => {
      vi.mocked(prisma.dashboard.findMany).mockRejectedValue(makePrismaError("P9999"));
      const { getDashboards } = await import("./dashboards");

      await expect(getDashboards(mockProjectId)).rejects.toMatchObject({
        name: "DatabaseError",
      });
    });
  });

  describe("addChartToDashboard", () => {
    const mockLayout = { x: 0, y: 0, w: 4, h: 3 };
    const mockWidget = {
      id: "widget-abc-123",
      dashboardId: mockDashboardId,
      chartId: mockChartId,
      title: "My Widget",
      layout: mockLayout,
      order: 0,
    };

    test("adds a chart to a dashboard as the first widget", async () => {
      mockTxChart.findFirst.mockResolvedValue({ id: mockChartId });
      mockTxDashboard.findFirst.mockResolvedValue(mockDashboard);
      mockTxWidget.aggregate.mockResolvedValue({ _max: { order: null } });
      mockTxWidget.create.mockResolvedValue(mockWidget);
      const { addChartToDashboard } = await import("./dashboards");

      const result = await addChartToDashboard({
        dashboardId: mockDashboardId,
        chartId: mockChartId,
        projectId: mockProjectId,
        title: "My Widget",
        layout: mockLayout,
      });

      expect(result).toEqual(mockWidget);
      expect(mockTxWidget.create).toHaveBeenCalledWith({
        data: {
          dashboardId: mockDashboardId,
          chartId: mockChartId,
          title: "My Widget",
          layout: mockLayout,
          order: 0,
        },
      });
    });

    test("appends widget after existing widgets", async () => {
      mockTxChart.findFirst.mockResolvedValue({ id: mockChartId });
      mockTxDashboard.findFirst.mockResolvedValue(mockDashboard);
      mockTxWidget.aggregate.mockResolvedValue({ _max: { order: 2 } });
      mockTxWidget.create.mockResolvedValue({ ...mockWidget, order: 3 });
      const { addChartToDashboard } = await import("./dashboards");

      await addChartToDashboard({
        dashboardId: mockDashboardId,
        chartId: mockChartId,
        projectId: mockProjectId,
        layout: mockLayout,
      });

      expect(mockTxWidget.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ order: 3 }),
      });
    });

    test("throws ResourceNotFoundError when chart does not exist", async () => {
      mockTxChart.findFirst.mockResolvedValue(null);
      mockTxDashboard.findFirst.mockResolvedValue(mockDashboard);
      const { addChartToDashboard } = await import("./dashboards");

      await expect(
        addChartToDashboard({
          dashboardId: mockDashboardId,
          chartId: mockChartId,
          projectId: mockProjectId,
          layout: mockLayout,
        })
      ).rejects.toMatchObject({
        name: "ResourceNotFoundError",
        resourceType: "Chart",
        resourceId: mockChartId,
      });
      expect(mockTxWidget.create).not.toHaveBeenCalled();
    });

    test("throws ResourceNotFoundError when dashboard does not exist", async () => {
      mockTxChart.findFirst.mockResolvedValue({ id: mockChartId });
      mockTxDashboard.findFirst.mockResolvedValue(null);
      const { addChartToDashboard } = await import("./dashboards");

      await expect(
        addChartToDashboard({
          dashboardId: mockDashboardId,
          chartId: mockChartId,
          projectId: mockProjectId,
          layout: mockLayout,
        })
      ).rejects.toMatchObject({
        name: "ResourceNotFoundError",
        resourceType: "Dashboard",
        resourceId: mockDashboardId,
      });
      expect(mockTxWidget.create).not.toHaveBeenCalled();
    });

    test("throws InvalidInputError on unique constraint violation", async () => {
      mockTxChart.findFirst.mockResolvedValue({ id: mockChartId });
      mockTxDashboard.findFirst.mockResolvedValue(mockDashboard);
      mockTxWidget.aggregate.mockResolvedValue({ _max: { order: null } });
      mockTxWidget.create.mockRejectedValue(makePrismaError(PrismaErrorType.UniqueConstraintViolation));
      vi.mocked(prisma.$transaction).mockImplementation((cb: any) =>
        cb({ dashboard: mockTxDashboard, chart: mockTxChart, dashboardWidget: mockTxWidget })
      );
      const { addChartToDashboard } = await import("./dashboards");

      await expect(
        addChartToDashboard({
          dashboardId: mockDashboardId,
          chartId: mockChartId,
          projectId: mockProjectId,
          layout: mockLayout,
        })
      ).rejects.toMatchObject({
        name: "InvalidInputError",
      });
    });
  });
});
