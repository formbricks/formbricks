import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";

vi.mock("server-only", () => ({}));

var mockTxDashboard: {
  // NOSONAR / test code
  findFirst: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

var mockTxChart: { findFirst: ReturnType<typeof vi.fn> }; // NOSONAR / test code

var mockTxWidget: {
  // NOSONAR / test code
  aggregate: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
};

vi.mock("@formbricks/database", () => {
  const txDash = { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
  const txChart = { findFirst: vi.fn() };
  const txWidget = {
    aggregate: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  };
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
      dashboardWidget: txWidget,
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
    feedbackDirectoryId: true,
    createdAt: true,
    updatedAt: true,
  },
}));

const mockDashboardId = "dashboard-abc-123";
const mockWorkspaceId = "workspace-abc-123";
const mockUserId = "user-abc-123";
const mockChartId = "chart-abc-123";

const mockDashboard = {
  id: mockDashboardId,
  name: "Test Dashboard",
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
  createdBy: mockUserId,
};

const makePrismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("mock error", { code, clientVersion: "5.0.0" });

describe("Dashboard Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTxWidget.findFirst.mockResolvedValue(null);
  });

  describe("getDashboards", () => {
    test("returns all dashboards for a workspace with creator", async () => {
      const dashboards = [
        { ...mockDashboard, creator: { name: "Alice" }, _count: { widgets: 3 } },
        { ...mockDashboard, id: "dash-2", name: "Dashboard 2", creator: null, _count: { widgets: 0 } },
      ];
      vi.mocked(prisma.dashboard.findMany).mockResolvedValue(dashboards as any);
      const { getDashboards } = await import("./dashboards");

      const result = await getDashboards(mockWorkspaceId);

      expect(result).toEqual(dashboards);
      expect(prisma.dashboard.findMany).toHaveBeenCalledWith({
        where: { workspaceId: mockWorkspaceId },
        orderBy: { createdAt: "desc" },
        select: expect.objectContaining({
          id: true,
          name: true,
          creator: { select: { name: true } },
          _count: { select: { widgets: true } },
        }),
      });
    });

    test("returns empty array when no dashboards exist", async () => {
      vi.mocked(prisma.dashboard.findMany).mockResolvedValue([]);
      const { getDashboards } = await import("./dashboards");

      const result = await getDashboards(mockWorkspaceId);

      expect(result).toEqual([]);
    });

    test("throws DatabaseError on Prisma errors", async () => {
      vi.mocked(prisma.dashboard.findMany).mockRejectedValue(makePrismaError("P9999"));
      const { getDashboards } = await import("./dashboards");

      await expect(getDashboards(mockWorkspaceId)).rejects.toMatchObject({
        name: "DatabaseError",
      });
    });

    test("rethrows non-Prisma errors unchanged", async () => {
      vi.mocked(prisma.dashboard.findMany).mockRejectedValue(new Error("boom"));
      const { getDashboards } = await import("./dashboards");

      await expect(getDashboards(mockWorkspaceId)).rejects.toThrow("boom");
    });

    test("returns containsChart per dashboard when chartId is provided", async () => {
      const dashboards = [
        {
          ...mockDashboard,
          creator: { name: "Alice" },
          _count: { widgets: 3 },
          widgets: [{ id: "widget-1" }],
        },
        {
          ...mockDashboard,
          id: "dash-2",
          name: "Dashboard 2",
          creator: null,
          _count: { widgets: 0 },
          widgets: [],
        },
      ];
      vi.mocked(prisma.dashboard.findMany).mockResolvedValue(dashboards as any);
      const { getDashboards } = await import("./dashboards");

      const result = await getDashboards(mockWorkspaceId, mockChartId);

      expect(result[0]).toMatchObject({ containsChart: true });
      expect(result[1]).toMatchObject({ containsChart: false });
      expect((result[0] as any).widgets).toBeUndefined();
      expect(prisma.dashboard.findMany).toHaveBeenCalledWith({
        where: { workspaceId: mockWorkspaceId },
        orderBy: { createdAt: "desc" },
        select: expect.objectContaining({
          widgets: { where: { chartId: mockChartId }, select: { id: true }, take: 1 },
        }),
      });
    });
  });

  describe("addChartToDashboard", () => {
    const mockLayout = { x: 0, y: 0, w: 4, h: 3 };
    const mockWidget = {
      id: "widget-abc-123",
      dashboardId: mockDashboardId,
      chartId: mockChartId,
      layout: mockLayout,
      order: 0,
    };

    test("adds a chart to a dashboard as the first widget", async () => {
      mockTxChart.findFirst.mockResolvedValue({ id: mockChartId });
      mockTxDashboard.findFirst.mockResolvedValue(mockDashboard);
      mockTxWidget.aggregate.mockResolvedValue({ _max: { order: null } });
      mockTxWidget.findMany.mockResolvedValue([]);
      mockTxWidget.create.mockResolvedValue(mockWidget);
      const { addChartToDashboard } = await import("./dashboards");

      const result = await addChartToDashboard({
        dashboardId: mockDashboardId,
        chartId: mockChartId,
        workspaceId: mockWorkspaceId,
        layout: mockLayout,
      });

      expect(result).toEqual(mockWidget);
      expect(mockTxWidget.create).toHaveBeenCalledWith({
        data: {
          dashboardId: mockDashboardId,
          chartId: mockChartId,
          layout: mockLayout,
          order: 0,
        },
      });
    });

    test("appends widget after existing widgets", async () => {
      mockTxChart.findFirst.mockResolvedValue({ id: mockChartId });
      mockTxDashboard.findFirst.mockResolvedValue(mockDashboard);
      mockTxWidget.aggregate.mockResolvedValue({ _max: { order: 2 } });
      mockTxWidget.findMany.mockResolvedValue([{ layout: { y: 0, h: 3 } }]);
      mockTxWidget.create.mockResolvedValue({ ...mockWidget, order: 3 });
      const { addChartToDashboard } = await import("./dashboards");

      await addChartToDashboard({
        dashboardId: mockDashboardId,
        chartId: mockChartId,
        workspaceId: mockWorkspaceId,
        layout: mockLayout,
      });

      expect(mockTxWidget.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ order: 3 }),
      });
    });

    // ENG-3209: a chart added from the chart builder or "add existing charts" was appended below every
    // widget, leaving a visible gap beside a narrower one. Every add now fills the first open slot.
    test("places a new widget in the first gap it fits", async () => {
      mockTxChart.findFirst.mockResolvedValue({ id: mockChartId });
      mockTxDashboard.findFirst.mockResolvedValue(mockDashboard);
      mockTxWidget.aggregate.mockResolvedValue({ _max: { order: 1 } });
      mockTxWidget.findMany.mockResolvedValue([
        { layout: { x: 0, y: 0, w: 4, h: 3 } },
        { layout: { x: 8, y: 0, w: 4, h: 3 } },
      ]);
      mockTxWidget.create.mockResolvedValue(mockWidget);
      const { addChartToDashboard } = await import("./dashboards");

      await addChartToDashboard({
        dashboardId: mockDashboardId,
        chartId: mockChartId,
        workspaceId: mockWorkspaceId,
        layout: mockLayout,
      });

      expect(mockTxWidget.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ layout: { x: 4, y: 0, w: 4, h: 3 } }),
      });
    });

    test("drops a new widget below a full row", async () => {
      mockTxChart.findFirst.mockResolvedValue({ id: mockChartId });
      mockTxDashboard.findFirst.mockResolvedValue(mockDashboard);
      mockTxWidget.aggregate.mockResolvedValue({ _max: { order: 0 } });
      mockTxWidget.findMany.mockResolvedValue([{ layout: { x: 0, y: 0, w: 12, h: 3 } }]);
      mockTxWidget.create.mockResolvedValue(mockWidget);
      const { addChartToDashboard } = await import("./dashboards");

      await addChartToDashboard({
        dashboardId: mockDashboardId,
        chartId: mockChartId,
        workspaceId: mockWorkspaceId,
        layout: mockLayout,
      });

      expect(mockTxWidget.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ layout: { x: 0, y: 3, w: 4, h: 3 } }),
      });
    });

    test("appends instead of filling a gap when a stored layout is unreadable", async () => {
      mockTxChart.findFirst.mockResolvedValue({ id: mockChartId });
      mockTxDashboard.findFirst.mockResolvedValue(mockDashboard);
      mockTxWidget.aggregate.mockResolvedValue({ _max: { order: 1 } });
      // The gap at x=4 cannot be trusted: the unreadable row may be sitting in it.
      mockTxWidget.findMany.mockResolvedValue([
        { layout: { x: 0, y: 0, w: 4, h: 3 } },
        { layout: "not-a-layout" },
      ]);
      mockTxWidget.create.mockResolvedValue(mockWidget);
      const { addChartToDashboard } = await import("./dashboards");

      await addChartToDashboard({
        dashboardId: mockDashboardId,
        chartId: mockChartId,
        workspaceId: mockWorkspaceId,
        layout: mockLayout,
      });

      expect(mockTxWidget.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ layout: { x: 0, y: 3, w: 4, h: 3 } }),
      });
    });

    test("retries the transaction when the database reports a conflict", async () => {
      mockTxChart.findFirst.mockResolvedValue({ id: mockChartId });
      mockTxDashboard.findFirst.mockResolvedValue(mockDashboard);
      mockTxWidget.aggregate.mockResolvedValue({ _max: { order: null } });
      mockTxWidget.findMany.mockResolvedValue([]);
      mockTxWidget.create.mockResolvedValue(mockWidget);

      const conflict = new Prisma.PrismaClientKnownRequestError("write conflict", {
        code: "P2034",
        clientVersion: "5.0.0",
      });
      let attempts = 0;
      vi.mocked(prisma.$transaction).mockImplementation((cb: any) => {
        attempts++;
        if (attempts === 1) return Promise.reject(conflict);
        return cb({ dashboard: mockTxDashboard, chart: mockTxChart, dashboardWidget: mockTxWidget });
      });
      const { addChartToDashboard } = await import("./dashboards");

      const result = await addChartToDashboard({
        dashboardId: mockDashboardId,
        chartId: mockChartId,
        workspaceId: mockWorkspaceId,
        layout: mockLayout,
      });

      expect(result).toEqual(mockWidget);
      expect(attempts).toBe(2);
    });

    test("gives up on a conflict that keeps repeating", async () => {
      const conflict = new Prisma.PrismaClientKnownRequestError("write conflict", {
        code: "P2034",
        clientVersion: "5.0.0",
      });
      let attempts = 0;
      vi.mocked(prisma.$transaction).mockImplementation(() => {
        attempts++;
        return Promise.reject(conflict);
      });
      const { addChartToDashboard } = await import("./dashboards");

      await expect(
        addChartToDashboard({
          dashboardId: mockDashboardId,
          chartId: mockChartId,
          workspaceId: mockWorkspaceId,
          layout: mockLayout,
        })
      ).rejects.toMatchObject({ name: "DatabaseError" });
      expect(attempts).toBe(3);
    });

    test("throws ResourceNotFoundError when chart does not exist", async () => {
      mockTxChart.findFirst.mockResolvedValue(null);
      mockTxDashboard.findFirst.mockResolvedValue(mockDashboard);
      const { addChartToDashboard } = await import("./dashboards");

      await expect(
        addChartToDashboard({
          dashboardId: mockDashboardId,
          chartId: mockChartId,
          workspaceId: mockWorkspaceId,
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
          workspaceId: mockWorkspaceId,
          layout: mockLayout,
        })
      ).rejects.toMatchObject({
        name: "ResourceNotFoundError",
        resourceType: "Dashboard",
        resourceId: mockDashboardId,
      });
      expect(mockTxWidget.create).not.toHaveBeenCalled();
    });

    test("throws InvalidInputError when chart is already on the dashboard", async () => {
      mockTxChart.findFirst.mockResolvedValue({ id: mockChartId });
      mockTxDashboard.findFirst.mockResolvedValue(mockDashboard);
      mockTxWidget.findFirst.mockResolvedValue({ id: "existing-widget-abc-123" });
      const { addChartToDashboard } = await import("./dashboards");

      await expect(
        addChartToDashboard({
          dashboardId: mockDashboardId,
          chartId: mockChartId,
          workspaceId: mockWorkspaceId,
          layout: mockLayout,
        })
      ).rejects.toMatchObject({
        name: "InvalidInputError",
      });
      expect(mockTxWidget.aggregate).not.toHaveBeenCalled();
      expect(mockTxWidget.create).not.toHaveBeenCalled();
    });

    test("throws InvalidInputError on unique constraint violation", async () => {
      mockTxChart.findFirst.mockResolvedValue({ id: mockChartId });
      mockTxDashboard.findFirst.mockResolvedValue(mockDashboard);
      mockTxWidget.aggregate.mockResolvedValue({ _max: { order: null } });
      mockTxWidget.findMany.mockResolvedValue([]);
      mockTxWidget.create.mockRejectedValue(makePrismaError(PrismaErrorType.UniqueConstraintViolation));
      vi.mocked(prisma.$transaction).mockImplementation((cb: any) =>
        cb({ dashboard: mockTxDashboard, chart: mockTxChart, dashboardWidget: mockTxWidget })
      );
      const { addChartToDashboard } = await import("./dashboards");

      await expect(
        addChartToDashboard({
          dashboardId: mockDashboardId,
          chartId: mockChartId,
          workspaceId: mockWorkspaceId,
          layout: mockLayout,
        })
      ).rejects.toMatchObject({
        name: "InvalidInputError",
      });
    });

    test("throws DatabaseError on other Prisma errors", async () => {
      mockTxChart.findFirst.mockResolvedValue({ id: mockChartId });
      mockTxDashboard.findFirst.mockResolvedValue(mockDashboard);
      mockTxWidget.aggregate.mockResolvedValue({ _max: { order: null } });
      mockTxWidget.findMany.mockResolvedValue([]);
      mockTxWidget.create.mockRejectedValue(makePrismaError("P2010"));
      vi.mocked(prisma.$transaction).mockImplementation((cb: any) =>
        cb({ dashboard: mockTxDashboard, chart: mockTxChart, dashboardWidget: mockTxWidget })
      );
      const { addChartToDashboard } = await import("./dashboards");

      await expect(
        addChartToDashboard({
          dashboardId: mockDashboardId,
          chartId: mockChartId,
          workspaceId: mockWorkspaceId,
          layout: mockLayout,
        })
      ).rejects.toMatchObject({
        name: "DatabaseError",
      });
    });

    test("rethrows non-Prisma errors unchanged", async () => {
      mockTxChart.findFirst.mockResolvedValue({ id: mockChartId });
      mockTxDashboard.findFirst.mockResolvedValue(mockDashboard);
      mockTxWidget.aggregate.mockResolvedValue({ _max: { order: null } });
      mockTxWidget.findMany.mockResolvedValue([]);
      mockTxWidget.create.mockRejectedValue(new Error("boom"));
      vi.mocked(prisma.$transaction).mockImplementation((cb: any) =>
        cb({ dashboard: mockTxDashboard, chart: mockTxChart, dashboardWidget: mockTxWidget })
      );
      const { addChartToDashboard } = await import("./dashboards");

      await expect(
        addChartToDashboard({
          dashboardId: mockDashboardId,
          chartId: mockChartId,
          workspaceId: mockWorkspaceId,
          layout: mockLayout,
        })
      ).rejects.toThrow("boom");
    });
  });
});
