import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";
import { getProjectPermissionByUserId, getTeamRoleByTeamIdUserId } from "./roles";

vi.mock("@formbricks/database", () => ({
  prisma: {
    projectTeam: { findMany: vi.fn() },
    teamUser: { findUnique: vi.fn() },
  },
}));

vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/utils/validate", () => ({ validateInputs: vi.fn() }));

const mockUserId = "user-1";
const mockProjectId = "project-1";
const mockTeamId = "team-1";

describe("roles lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProjectPermissionByUserId", () => {
    test("returns null if no memberships", async () => {
      vi.mocked(prisma.projectTeam.findMany).mockResolvedValueOnce([]);
      const result = await getProjectPermissionByUserId(mockUserId, mockProjectId);
      expect(result).toBeNull();
      expect(validateInputs).toHaveBeenCalledWith(
        [mockUserId, expect.anything()],
        [mockProjectId, expect.anything()]
      );
    });

    test("returns 'manage' if any membership has manage", async () => {
      vi.mocked(prisma.projectTeam.findMany).mockResolvedValueOnce([
        { permission: "read" },
        { permission: "manage" },
        { permission: "readWrite" },
      ] as any);
      const result = await getProjectPermissionByUserId(mockUserId, mockProjectId);
      expect(result).toBe("manage");
    });

    test("returns 'readWrite' if highest is readWrite", async () => {
      vi.mocked(prisma.projectTeam.findMany).mockResolvedValueOnce([
        { permission: "read" },
        { permission: "readWrite" },
      ] as any);
      const result = await getProjectPermissionByUserId(mockUserId, mockProjectId);
      expect(result).toBe("readWrite");
    });

    test("returns 'read' if only read", async () => {
      vi.mocked(prisma.projectTeam.findMany).mockResolvedValueOnce([{ permission: "read" }] as any);
      const result = await getProjectPermissionByUserId(mockUserId, mockProjectId);
      expect(result).toBe("read");
    });

    test("throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const error = new Prisma.PrismaClientKnownRequestError("fail", {
        code: "P2002",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.projectTeam.findMany).mockRejectedValueOnce(error);
      await expect(getProjectPermissionByUserId(mockUserId, mockProjectId)).rejects.toThrow(DatabaseError);
      expect(logger.error).toHaveBeenCalledWith(error, expect.any(String));
    });

    test("throws UnknownError on generic error", async () => {
      const error = new Error("fail");
      vi.mocked(prisma.projectTeam.findMany).mockRejectedValueOnce(error);
      await expect(getProjectPermissionByUserId(mockUserId, mockProjectId)).rejects.toThrow(UnknownError);
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
      vi.mocked(prisma.teamUser.findUnique).mockResolvedValueOnce({ role: "member" });
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
});
