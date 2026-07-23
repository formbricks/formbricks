import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { duplicateChart } from "@/modules/ee/analysis/charts/lib/charts";
import { addChartToDashboard } from "./dashboards";
import { duplicateChartAndAddWidget } from "./duplicate-chart-and-add-widget";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    dashboard: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@/modules/ee/analysis/charts/lib/charts", () => ({
  duplicateChart: vi.fn(),
}));

vi.mock("./dashboards", () => ({
  addChartToDashboard: vi.fn(),
}));

const mockDashboardId = "dashboard-abc-123";
const mockWorkspaceId = "workspace-abc-123";
const mockUserId = "user-abc-123";
const mockChartId = "chart-abc-123";
const mockLayout = { x: 0, y: 0, w: 4, h: 3 };

const mockDuplicatedChart = {
  id: "chart-copy-123",
  name: "Test Chart (copy)",
  type: "bar",
  query: { measures: ["Feedback.count"] },
  config: {},
  feedbackDirectoryId: "directory-abc-123",
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

const mockWidget = {
  id: "widget-new-123",
  dashboardId: mockDashboardId,
  chartId: mockDuplicatedChart.id,
  layout: mockLayout,
  order: 1,
};

const makePrismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("mock error", { code, clientVersion: "5.0.0" });

describe("duplicateChartAndAddWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("duplicates the chart and adds it as a widget on the same dashboard", async () => {
    vi.mocked(prisma.dashboard.findFirst).mockResolvedValue({ id: mockDashboardId } as any);
    vi.mocked(duplicateChart).mockResolvedValue(mockDuplicatedChart as any);
    vi.mocked(addChartToDashboard).mockResolvedValue(mockWidget as any);

    const result = await duplicateChartAndAddWidget({
      dashboardId: mockDashboardId,
      workspaceId: mockWorkspaceId,
      chartId: mockChartId,
      createdBy: mockUserId,
      layout: mockLayout,
    });

    expect(result).toEqual({ chart: mockDuplicatedChart, widget: mockWidget });
    expect(prisma.dashboard.findFirst).toHaveBeenCalledWith({
      where: { id: mockDashboardId, workspaceId: mockWorkspaceId },
      select: { id: true },
    });
    expect(duplicateChart).toHaveBeenCalledWith(mockChartId, mockWorkspaceId, mockUserId);
    expect(addChartToDashboard).toHaveBeenCalledWith({
      dashboardId: mockDashboardId,
      chartId: mockDuplicatedChart.id,
      workspaceId: mockWorkspaceId,
      layout: mockLayout,
    });
  });

  test("passes an undefined layout through so the widget gets the chart-type default", async () => {
    vi.mocked(prisma.dashboard.findFirst).mockResolvedValue({ id: mockDashboardId } as any);
    vi.mocked(duplicateChart).mockResolvedValue(mockDuplicatedChart as any);
    vi.mocked(addChartToDashboard).mockResolvedValue(mockWidget as any);

    await duplicateChartAndAddWidget({
      dashboardId: mockDashboardId,
      workspaceId: mockWorkspaceId,
      chartId: mockChartId,
      createdBy: mockUserId,
    });

    expect(addChartToDashboard).toHaveBeenCalledWith({
      dashboardId: mockDashboardId,
      chartId: mockDuplicatedChart.id,
      workspaceId: mockWorkspaceId,
      layout: undefined,
    });
  });

  test("throws ResourceNotFoundError and does not duplicate when the dashboard is not in the workspace", async () => {
    vi.mocked(prisma.dashboard.findFirst).mockResolvedValue(null);

    await expect(
      duplicateChartAndAddWidget({
        dashboardId: mockDashboardId,
        workspaceId: mockWorkspaceId,
        chartId: mockChartId,
        createdBy: mockUserId,
      })
    ).rejects.toMatchObject({
      name: "ResourceNotFoundError",
      resourceType: "Dashboard",
      resourceId: mockDashboardId,
    });
    expect(duplicateChart).not.toHaveBeenCalled();
    expect(addChartToDashboard).not.toHaveBeenCalled();
  });

  test("propagates duplicateChart errors without adding a widget", async () => {
    vi.mocked(prisma.dashboard.findFirst).mockResolvedValue({ id: mockDashboardId } as any);
    vi.mocked(duplicateChart).mockRejectedValue(
      Object.assign(new Error("Chart not found"), { name: "ResourceNotFoundError" })
    );

    await expect(
      duplicateChartAndAddWidget({
        dashboardId: mockDashboardId,
        workspaceId: mockWorkspaceId,
        chartId: mockChartId,
        createdBy: mockUserId,
      })
    ).rejects.toMatchObject({ name: "ResourceNotFoundError" });
    expect(addChartToDashboard).not.toHaveBeenCalled();
  });

  test("wraps Prisma errors from the dashboard lookup in DatabaseError", async () => {
    vi.mocked(prisma.dashboard.findFirst).mockRejectedValue(makePrismaError("P9999"));

    await expect(
      duplicateChartAndAddWidget({
        dashboardId: mockDashboardId,
        workspaceId: mockWorkspaceId,
        chartId: mockChartId,
        createdBy: mockUserId,
      })
    ).rejects.toMatchObject({ name: "DatabaseError" });
    expect(duplicateChart).not.toHaveBeenCalled();
  });
});
