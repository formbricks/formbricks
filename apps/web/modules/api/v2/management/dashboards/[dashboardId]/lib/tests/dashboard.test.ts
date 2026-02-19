import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TDashboardUpdateInput } from "@/modules/api/v2/management/dashboards/[dashboardId]/types/dashboards";
import { deleteDashboard, getDashboard, updateDashboard } from "../dashboard";
import {
  mockedDashboard,
  prismaNotFoundError,
  prismaUniqueConstraintError,
} from "./mocks/dashboard.mock";

vi.mock("@formbricks/database", () => ({
  prisma: {
    dashboard: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe("getDashboard", () => {
  test("returns ok if dashboard is found", async () => {
    vi.mocked(prisma.dashboard.findUnique).mockResolvedValueOnce(mockedDashboard);
    const result = await getDashboard("dashboard123");
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data).toEqual(mockedDashboard);
    }
  });

  test("returns err if dashboard not found", async () => {
    vi.mocked(prisma.dashboard.findUnique).mockResolvedValueOnce(null);
    const result = await getDashboard("nonexistent");
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toBe("not_found");
    }
  });

  test("returns err on Prisma error", async () => {
    vi.mocked(prisma.dashboard.findUnique).mockRejectedValueOnce(new Error("DB error"));
    const result = await getDashboard("error");
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.type).toBe("internal_server_error");
    }
  });
});

describe("updateDashboard", () => {
  const updateInput: TDashboardUpdateInput = { name: "Updated Dashboard" };

  test("returns ok on successful update", async () => {
    const updatedDashboard = { ...mockedDashboard, name: "Updated Dashboard" };
    vi.mocked(prisma.dashboard.update).mockResolvedValueOnce(updatedDashboard);
    const result = await updateDashboard("dashboard123", updateInput);
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.name).toBe("Updated Dashboard");
    }
  });

  test("returns not_found if record does not exist", async () => {
    vi.mocked(prisma.dashboard.update).mockRejectedValueOnce(prismaNotFoundError);
    const result = await updateDashboard("nonexistent", updateInput);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toBe("not_found");
    }
  });

  test("returns conflict on duplicate name", async () => {
    vi.mocked(prisma.dashboard.update).mockRejectedValueOnce(prismaUniqueConstraintError);
    const result = await updateDashboard("dashboard123", updateInput);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toBe("conflict");
    }
  });

  test("returns internal_server_error on other errors", async () => {
    vi.mocked(prisma.dashboard.update).mockRejectedValueOnce(new Error("Unknown error"));
    const result = await updateDashboard("dashboard123", updateInput);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toBe("internal_server_error");
    }
  });
});

describe("deleteDashboard", () => {
  test("returns ok on successful delete", async () => {
    vi.mocked(prisma.dashboard.delete).mockResolvedValueOnce(mockedDashboard);
    const result = await deleteDashboard("dashboard123");
    expect(result.ok).toBe(true);
  });

  test("returns not_found if record does not exist", async () => {
    vi.mocked(prisma.dashboard.delete).mockRejectedValueOnce(prismaNotFoundError);
    const result = await deleteDashboard("nonexistent");
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toBe("not_found");
    }
  });

  test("returns internal_server_error on other errors", async () => {
    vi.mocked(prisma.dashboard.delete).mockRejectedValueOnce(new Error("Delete error"));
    const result = await deleteDashboard("error");
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toBe("internal_server_error");
    }
  });
});
