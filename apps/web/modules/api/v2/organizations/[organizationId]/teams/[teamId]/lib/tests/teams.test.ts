import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { reconcileTeamWorkspaceRelationships } from "@/lib/authzed/team-workspace";
import { deleteTeam, getTeam, updateTeam } from "../teams";

vi.mock("@formbricks/database", () => ({
  prisma: {
    team: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/authzed/team-workspace", () => ({
  reconcileTeamWorkspaceRelationships: vi.fn(),
}));

// Define a mock team
const mockTeam = {
  id: "team123",
  organizationId: "org456",
  name: "Test Team",
  workspaceTeams: [{ workspaceId: "proj1" }, { workspaceId: "proj2" }],
};

describe("Teams Lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTeam", () => {
    test("returns the team when found", async () => {
      vi.mocked(prisma.team.findUnique, { partial: true }).mockResolvedValueOnce(mockTeam);
      const result = await getTeam("org456", "team123");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockTeam);
      }
      expect(prisma.team.findUnique).toHaveBeenCalledWith({
        where: { id: "team123", organizationId: "org456" },
      });
    });

    test("returns a not_found error when team is missing", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValueOnce(null);
      const result = await getTeam("org456", "team123");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "team", issue: "not found" }],
        });
      }
    });

    test("returns an internal_server_error when prisma throws", async () => {
      vi.mocked(prisma.team.findUnique).mockRejectedValueOnce(new Error("DB error"));
      const result = await getTeam("org456", "team123");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toHaveProperty("type", "internal_server_error");
      }
    });
  });

  describe("deleteTeam", () => {
    test("deletes the team", async () => {
      vi.mocked(prisma.team.delete, { partial: true }).mockResolvedValueOnce(mockTeam);
      const result = await deleteTeam("org456", "team123");
      expect(prisma.team.delete).toHaveBeenCalledWith({
        where: { id: "team123", organizationId: "org456" },
        include: { workspaceTeams: { select: { workspaceId: true } } },
      });
      expect(result.ok).toBe(true);
      expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledWith({ teamIds: ["team123"] });
      if (result.ok) {
        expect(result.data).toEqual(mockTeam);
      }
    });

    test("returns not_found error on known prisma error", async () => {
      vi.mocked(prisma.team.delete).mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Not found", {
          code: PrismaErrorType.RecordNotFound,
          clientVersion: "1.0.0",
          meta: {},
        })
      );
      const result = await deleteTeam("org456", "team123");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "team", issue: "not found" }],
        });
      }
    });

    test("returns internal_server_error on exception", async () => {
      vi.mocked(prisma.team.delete).mockRejectedValueOnce(new Error("Delete failed"));
      const result = await deleteTeam("org456", "team123");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
      }
    });
  });

  describe("updateTeam", () => {
    const updateInput = { name: "Updated Team" };
    const updatedTeam = { ...mockTeam, ...updateInput };

    test("updates the team successfully", async () => {
      vi.mocked(prisma.team.update, { partial: true }).mockResolvedValueOnce(updatedTeam);
      const result = await updateTeam("org456", "team123", updateInput);
      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: "team123", organizationId: "org456" },
        data: updateInput,
        include: { workspaceTeams: { select: { workspaceId: true } } },
      });
      expect(result.ok).toBe(true);
      expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledWith({ teamIds: ["team123"] });
      if (result.ok) {
        expect(result.data).toEqual(updatedTeam);
      }
    });

    test("returns not_found error when update fails due to missing team", async () => {
      vi.mocked(prisma.team.update).mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Not found", {
          code: PrismaErrorType.RecordNotFound,
          clientVersion: "1.0.0",
          meta: {},
        })
      );
      const result = await updateTeam("org456", "team123", updateInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "team", issue: "not found" }],
        });
      }
    });

    test("returns internal_server_error on generic exception", async () => {
      vi.mocked(prisma.team.update).mockRejectedValueOnce(new Error("Update failed"));
      const result = await updateTeam("org456", "team123", updateInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
      }
    });
  });
});
