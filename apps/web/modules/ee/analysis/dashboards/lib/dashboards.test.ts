import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: { dashboard: { findMany: vi.fn() } },
}));

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
});
