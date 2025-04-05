import {
  TGetProjectTeamsFilter,
  TProjectTeamInput,
  projectTeamUpdateSchema,
} from "@/modules/api/v2/organizations/[organizationId]/project-teams/types/project-teams";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TypeOf } from "zod";
import { prisma } from "@formbricks/database";
import { createProjectTeam, deleteProjectTeam, getProjectTeams, updateProjectTeam } from "../project-teams";

vi.mock("@formbricks/database", () => ({
  prisma: {
    projectTeam: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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
      const result = await getProjectTeams("orgx", { skip: 0, limit: 10 } as TGetProjectTeamsFilter);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.data).toEqual(mockTeams);
        expect(result.data.meta).not.toBeNull();
        if (result.data.meta) {
          expect(result.data.meta.total).toBe(mockTeams.length);
        }
      }
    });

    it("returns internal_server_error on exception", async () => {
      (prisma.$transaction as any).mockRejectedValueOnce(new Error("DB error"));
      const result = await getProjectTeams("orgx", { skip: 0, limit: 10 } as TGetProjectTeamsFilter);
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
      const result = await createProjectTeam({
        projectId: "p1",
        teamId: "t1",
      } as TProjectTeamInput);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect((result.data as any).id).toBe("ptx");
      }
    });

    it("returns internal_server_error on error", async () => {
      (prisma.projectTeam.create as any).mockRejectedValueOnce(new Error("Create error"));
      const result = await createProjectTeam({
        projectId: "p1",
        teamId: "t1",
      } as TProjectTeamInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
      }
    });
  });

  describe("updateProjectTeam", () => {
    it("updates a projectTeam successfully", async () => {
      (prisma.projectTeam.update as any).mockResolvedValueOnce({
        id: "pt01",
        projectId: "p1",
        teamId: "t1",
        permission: "READ",
      });
      const result = await updateProjectTeam("t1", "p1", { permission: "READ" } as unknown as TypeOf<
        typeof projectTeamUpdateSchema
      >);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.permission).toBe("READ");
      }
    });

    it("returns internal_server_error on error", async () => {
      (prisma.projectTeam.update as any).mockRejectedValueOnce(new Error("Update error"));
      const result = await updateProjectTeam("t1", "p1", { permission: "READ" } as unknown as TypeOf<
        typeof projectTeamUpdateSchema
      >);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
      }
    });
  });

  describe("deleteProjectTeam", () => {
    it("deletes a projectTeam successfully", async () => {
      (prisma.projectTeam.delete as any).mockResolvedValueOnce({
        projectId: "p1",
        teamId: "t1",
        permission: "READ",
      });
      const result = await deleteProjectTeam("t1", "p1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.projectId).toBe("p1");
        expect(result.data.teamId).toBe("t1");
      }
    });

    it("returns internal_server_error on error", async () => {
      (prisma.projectTeam.delete as any).mockRejectedValueOnce(new Error("Delete error"));
      const result = await deleteProjectTeam("t1", "p1");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
      }
    });
  });
});
