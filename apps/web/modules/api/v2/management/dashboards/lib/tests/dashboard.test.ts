import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  TDashboardInput,
  TGetDashboardsFilter,
} from "@/modules/api/v2/management/dashboards/types/dashboards";
import { createDashboard, getDashboards } from "../dashboard";

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    dashboard: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe("getDashboards", () => {
  const projectIds = ["project1"];
  const params = {
    limit: 10,
    skip: 0,
  };
  const fakeDashboards = [
    { id: "d1", projectId: "project1", name: "Dashboard One" },
    { id: "d2", projectId: "project1", name: "Dashboard Two" },
  ];
  const count = fakeDashboards.length;

  test("returns ok response with dashboards and meta", async () => {
    vi.mocked(prisma.$transaction).mockResolvedValueOnce([fakeDashboards, count]);

    const result = await getDashboards(projectIds, params as TGetDashboardsFilter);
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.data).toEqual(fakeDashboards);
      expect(result.data.meta).toEqual({
        total: count,
        limit: params.limit,
        offset: params.skip,
      });
    }
  });

  test("returns error when prisma.$transaction throws", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error("Test error"));

    const result = await getDashboards(projectIds, params as TGetDashboardsFilter);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toEqual("internal_server_error");
    }
  });
});

describe("createDashboard", () => {
  const inputDashboard: TDashboardInput = {
    projectId: "project1",
    name: "New Dashboard",
    description: "A new dashboard",
  };

  const createdDashboard = {
    id: "d100",
    projectId: inputDashboard.projectId,
    name: inputDashboard.name,
    description: inputDashboard.description,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  test("creates a dashboard", async () => {
    vi.mocked(prisma.dashboard.create).mockResolvedValueOnce(createdDashboard);

    const result = await createDashboard(inputDashboard);
    expect(prisma.dashboard.create).toHaveBeenCalled();
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data).toEqual(createdDashboard);
    }
  });

  test("returns conflict error on duplicate name", async () => {
    const { prismaUniqueConstraintError } = await import(
      "@/modules/api/v2/management/dashboards/[dashboardId]/lib/tests/mocks/dashboard.mock"
    );
    vi.mocked(prisma.dashboard.create).mockRejectedValueOnce(prismaUniqueConstraintError);

    const result = await createDashboard(inputDashboard);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.type).toEqual("conflict");
    }
  });

  test("returns error when creation fails", async () => {
    vi.mocked(prisma.dashboard.create).mockRejectedValueOnce(new Error("Creation failed"));

    const result = await createDashboard(inputDashboard);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.type).toEqual("internal_server_error");
    }
  });
});
