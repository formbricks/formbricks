import { beforeEach, describe, expect, test, vi } from "vitest";
import { TypeOf } from "zod";
import { prisma } from "@formbricks/database";
import {
  TGetWorkspaceTeamsFilter,
  TWorkspaceTeamInput,
  ZWorkspaceZTeamUpdateSchema,
} from "@/modules/api/v2/organizations/[organizationId]/workspace-teams/types/workspace-teams";
import {
  createWorkspaceTeam,
  deleteWorkspaceTeam,
  getWorkspaceTeams,
  updateWorkspaceTeam,
} from "../workspace-teams";

vi.mock("@formbricks/database", () => ({
  prisma: {
    workspaceTeam: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe("WorkspaceTeams Lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getWorkspaceTeams", () => {
    test("returns workspaceTeams with meta on success", async () => {
      const mockTeams = [{ id: "projTeam1", organizationId: "orgx", workspaceId: "p1", teamId: "t1" }];
      (prisma.$transaction as any).mockResolvedValueOnce([mockTeams, mockTeams.length]);
      const result = await getWorkspaceTeams("orgx", { skip: 0, limit: 10 } as TGetWorkspaceTeamsFilter);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.data).toEqual(mockTeams);
        expect(result.data.meta).not.toBeNull();
        if (result.data.meta) {
          expect(result.data.meta.total).toBe(mockTeams.length);
        }
      }
    });

    test("returns internal_server_error on exception", async () => {
      (prisma.$transaction as any).mockRejectedValueOnce(new Error("DB error"));
      const result = await getWorkspaceTeams("orgx", { skip: 0, limit: 10 } as TGetWorkspaceTeamsFilter);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
      }
    });
  });

  describe("createWorkspaceTeam", () => {
    test("creates a workspaceTeam successfully", async () => {
      const mockCreated = { id: "ptx", workspaceId: "p1", teamId: "t1", organizationId: "orgx" };
      (prisma.workspaceTeam.create as any).mockResolvedValueOnce(mockCreated);
      const result = await createWorkspaceTeam({
        workspaceId: "p1",
        teamId: "t1",
      } as TWorkspaceTeamInput & { workspaceId: string });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect((result.data as any).id).toBe("ptx");
      }
    });

    test("returns internal_server_error on error", async () => {
      (prisma.workspaceTeam.create as any).mockRejectedValueOnce(new Error("Create error"));
      const result = await createWorkspaceTeam({
        workspaceId: "p1",
        teamId: "t1",
      } as TWorkspaceTeamInput & { workspaceId: string });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
      }
    });
  });

  describe("updateWorkspaceTeam", () => {
    test("updates a workspaceTeam successfully", async () => {
      (prisma.workspaceTeam.update as any).mockResolvedValueOnce({
        id: "pt01",
        workspaceId: "p1",
        teamId: "t1",
        permission: "READ",
      });
      const result = await updateWorkspaceTeam("t1", "p1", { permission: "READ" } as unknown as TypeOf<
        typeof ZWorkspaceZTeamUpdateSchema
      >);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.permission).toBe("READ");
      }
    });

    test("returns internal_server_error on error", async () => {
      (prisma.workspaceTeam.update as any).mockRejectedValueOnce(new Error("Update error"));
      const result = await updateWorkspaceTeam("t1", "p1", { permission: "READ" } as unknown as TypeOf<
        typeof ZWorkspaceZTeamUpdateSchema
      >);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
      }
    });
  });

  describe("deleteWorkspaceTeam", () => {
    test("deletes a workspaceTeam successfully", async () => {
      (prisma.workspaceTeam.delete as any).mockResolvedValueOnce({
        workspaceId: "p1",
        teamId: "t1",
        permission: "READ",
      });
      const result = await deleteWorkspaceTeam("t1", "p1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.workspaceId).toBe("p1");
        expect(result.data.teamId).toBe("t1");
      }
    });

    test("returns internal_server_error on error", async () => {
      (prisma.workspaceTeam.delete as any).mockRejectedValueOnce(new Error("Delete error"));
      const result = await deleteWorkspaceTeam("t1", "p1");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
      }
    });
  });
});
