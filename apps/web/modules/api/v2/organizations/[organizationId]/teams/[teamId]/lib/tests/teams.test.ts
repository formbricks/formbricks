import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
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

// Define a mock team
const mockTeam = {
  id: "team123",
  organizationId: "org456",
  name: "Test Team",
  projectTeams: [{ projectId: "proj1" }, { projectId: "proj2" }],
};

describe("Teams Lib", () => {
  describe("getTeam", () => {
    test("returns the team when found", async () => {
      (prisma.team.findUnique as any).mockResolvedValueOnce(mockTeam);
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
      (prisma.team.findUnique as any).mockResolvedValueOnce(null);
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
      (prisma.team.findUnique as any).mockRejectedValueOnce(new Error("DB error"));
      const result = await getTeam("org456", "team123");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect((result.error as any).type).toBe("internal_server_error");
      }
    });
  });

  describe("deleteTeam", () => {
    test("deletes the team", async () => {
      (prisma.team.delete as any).mockResolvedValueOnce(mockTeam);
      const result = await deleteTeam("org456", "team123");
      expect(prisma.team.delete).toHaveBeenCalledWith({
        where: { id: "team123", organizationId: "org456" },
        include: { projectTeams: { select: { projectId: true } } },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockTeam);
      }
    });

    test("returns not_found error on known prisma error", async () => {
      (prisma.team.delete as any).mockRejectedValueOnce(
        new PrismaClientKnownRequestError("Not found", {
          code: PrismaErrorType.RecordDoesNotExist,
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
      (prisma.team.delete as any).mockRejectedValueOnce(new Error("Delete failed"));
      const result = await deleteTeam("org456", "team123");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect((result.error as any).type).toBe("internal_server_error");
      }
    });
  });

  describe("updateTeam", () => {
    const updateInput = { name: "Updated Team" };
    const updatedTeam = { ...mockTeam, ...updateInput };

    test("updates the team successfully", async () => {
      (prisma.team.update as any).mockResolvedValueOnce(updatedTeam);
      const result = await updateTeam("org456", "team123", updateInput);
      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: "team123", organizationId: "org456" },
        data: updateInput,
        include: { projectTeams: { select: { projectId: true } } },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(updatedTeam);
      }
    });

    test("returns not_found error when update fails due to missing team", async () => {
      (prisma.team.update as any).mockRejectedValueOnce(
        new PrismaClientKnownRequestError("Not found", {
          code: PrismaErrorType.RecordDoesNotExist,
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
      (prisma.team.update as any).mockRejectedValueOnce(new Error("Update failed"));
      const result = await updateTeam("org456", "team123", updateInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect((result.error as any).type).toBe("internal_server_error");
      }
    });
  });
});
