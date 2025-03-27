import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getProjectTeams, createProjectTeam } from "../projectTeams";

vi.mock("@formbricks/database", () => ({
  prisma: {
    projectTeam: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe("ProjectTeams Lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProjectTeams", () => {
    it("returns projectTeams with meta on success", async () => {
      const mockTeams = [{ id: "projTeam1", organizationId: "orgx", projectId: "p1", teamId: "t1" }];
      (prisma.$transaction as any).mockResolvedValueOnce([mockTeams, mockTeams.length]);
      const result = await getProjectTeams("orgx", { skip: 0, limit: 10 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.data).toEqual(mockTeams);
        expect(result.data.meta.total).toBe(mockTeams.length);
      }
    });

    it("returns not_found when no projectTeams found", async () => {
      (prisma.$transaction as any).mockResolvedValueOnce([null, 0]);
      const result = await getProjectTeams("orgx", { skip: 0, limit: 10 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("not_found");
      }
    });

    it("returns internal_server_error on exception", async () => {
      (prisma.$transaction as any).mockRejectedValueOnce(new Error("DB error"));
      const result = await getProjectTeams("orgx", { skip: 0, limit: 10 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
      }
    });
  });

  describe("createProjectTeam", () => {
    it("creates a projectTeam successfully", async () => {
      const mockCreated = { id: "ptx", projectId: "p1", teamId: "t1", organizationId: "orgx" };
      (prisma.projectTeam.create as any).mockResolvedValueOnce(mockCreated);
      const result = await createProjectTeam("orgx", {
        projectId: "p1",
        teamId: "t1",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect((result.data as any).id).toBe("ptx");
      }
    });

    it("returns internal_server_error on error", async () => {
      (prisma.projectTeam.create as any).mockRejectedValueOnce(new Error("Create error"));
      const result = await createProjectTeam("orgx", {
        projectId: "p1",
        teamId: "t1",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
      }
    });
  });
});
