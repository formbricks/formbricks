import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { getTeamRoleByTeamIdUserId, getTeamsWhereUserIsAdmin, getWorkspacePermissionByUserId } from "./roles";

vi.mock("@formbricks/database", () => ({
  prisma: {
    workspaceTeam: { findMany: vi.fn() },
    teamUser: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/utils/validate", () => ({ validateInputs: vi.fn() }));

const mockUserId = "user-1";
const mockWorkspaceId = "workspace-1";
const mockTeamId = "team-1";
const mockOrganizationId = "org-1";

describe("roles lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getWorkspacePermissionByUserId", () => {
    test("returns null if no memberships", async () => {
      vi.mocked(prisma.workspaceTeam.findMany).mockResolvedValueOnce([]);
      const result = await getWorkspacePermissionByUserId(mockUserId, mockWorkspaceId);
      expect(result).toBeNull();
      expect(validateInputs).toHaveBeenCalledWith(
        [mockUserId, expect.anything()],
        [mockWorkspaceId, expect.anything()]
      );
    });

    test("returns 'manage' if any membership has manage", async () => {
      vi.mocked(prisma.workspaceTeam.findMany).mockResolvedValueOnce([
        { permission: "read" },
        { permission: "manage" },
        { permission: "readWrite" },
      ] as any);
      const result = await getWorkspacePermissionByUserId(mockUserId, mockWorkspaceId);
      expect(result).toBe("manage");
    });

    test("returns 'readWrite' if highest is readWrite", async () => {
      vi.mocked(prisma.workspaceTeam.findMany).mockResolvedValueOnce([
        { permission: "read" },
        { permission: "readWrite" },
      ] as any);
      const result = await getWorkspacePermissionByUserId(mockUserId, mockWorkspaceId);
      expect(result).toBe("readWrite");
    });

    test("returns 'read' if only read", async () => {
      vi.mocked(prisma.workspaceTeam.findMany).mockResolvedValueOnce([{ permission: "read" }] as any);
      const result = await getWorkspacePermissionByUserId(mockUserId, mockWorkspaceId);
      expect(result).toBe("read");
    });

    test("throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const error = new Prisma.PrismaClientKnownRequestError("fail", {
        code: "P2002",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.workspaceTeam.findMany).mockRejectedValueOnce(error);
      await expect(getWorkspacePermissionByUserId(mockUserId, mockWorkspaceId)).rejects.toThrow(
        DatabaseError
      );
      expect(logger.error).toHaveBeenCalledWith(error, expect.any(String));
    });

    test("throws UnknownError on generic error", async () => {
      const error = new Error("fail");
      vi.mocked(prisma.workspaceTeam.findMany).mockRejectedValueOnce(error);
      await expect(getWorkspacePermissionByUserId(mockUserId, mockWorkspaceId)).rejects.toThrow(UnknownError);
    });
  });

  describe("getTeamRoleByTeamIdUserId", () => {
    test("returns null if no teamUser", async () => {
      vi.mocked(prisma.teamUser.findUnique).mockResolvedValueOnce(null);
      const result = await getTeamRoleByTeamIdUserId(mockTeamId, mockUserId);
      expect(result).toBeNull();
      expect(validateInputs).toHaveBeenCalledWith(
        [mockTeamId, expect.anything()],
        [mockUserId, expect.anything()]
      );
    });

    test("returns role if teamUser exists", async () => {
      vi.mocked(prisma.teamUser.findUnique).mockResolvedValueOnce({ role: "member" } as unknown as any);
      const result = await getTeamRoleByTeamIdUserId(mockTeamId, mockUserId);
      expect(result).toBe("member");
    });

    test("throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const error = new Prisma.PrismaClientKnownRequestError("fail", {
        code: "P2002",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.teamUser.findUnique).mockRejectedValueOnce(error);
      await expect(getTeamRoleByTeamIdUserId(mockTeamId, mockUserId)).rejects.toThrow(DatabaseError);
    });

    test("throws error on generic error", async () => {
      const error = new Error("fail");
      vi.mocked(prisma.teamUser.findUnique).mockRejectedValueOnce(error);
      await expect(getTeamRoleByTeamIdUserId(mockTeamId, mockUserId)).rejects.toThrow(error);
    });
  });

  describe("getTeamsWhereUserIsAdmin", () => {
    test("returns empty array if user is not admin of any team", async () => {
      vi.mocked(prisma.teamUser.findMany).mockResolvedValueOnce([]);
      const result = await getTeamsWhereUserIsAdmin(mockUserId, mockOrganizationId);
      expect(result).toEqual([]);
      expect(validateInputs).toHaveBeenCalledWith(
        [mockUserId, expect.anything()],
        [mockOrganizationId, expect.anything()]
      );
    });

    test("returns array of team IDs where user is admin", async () => {
      vi.mocked(prisma.teamUser.findMany).mockResolvedValueOnce([
        { teamId: "team-1" },
        { teamId: "team-2" },
        { teamId: "team-3" },
      ] as unknown as any);
      const result = await getTeamsWhereUserIsAdmin(mockUserId, mockOrganizationId);
      expect(result).toEqual(["team-1", "team-2", "team-3"]);
    });

    test("returns single team ID when user is admin of one team", async () => {
      vi.mocked(prisma.teamUser.findMany).mockResolvedValueOnce([{ teamId: "team-1" }] as unknown as any);
      const result = await getTeamsWhereUserIsAdmin(mockUserId, mockOrganizationId);
      expect(result).toEqual(["team-1"]);
    });

    test("throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const error = new Prisma.PrismaClientKnownRequestError("fail", {
        code: "P2002",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.teamUser.findMany).mockRejectedValueOnce(error);
      await expect(getTeamsWhereUserIsAdmin(mockUserId, mockOrganizationId)).rejects.toThrow(DatabaseError);
    });

    test("throws error on generic error", async () => {
      const error = new Error("fail");
      vi.mocked(prisma.teamUser.findMany).mockRejectedValueOnce(error);
      await expect(getTeamsWhereUserIsAdmin(mockUserId, mockOrganizationId)).rejects.toThrow(error);
    });
  });
});
