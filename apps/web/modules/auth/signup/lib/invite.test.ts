import { inviteCache } from "@/lib/cache/invite";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { deleteInvite, getInvite, getIsValidInviteToken } from "./invite";

// Mock data
const mockInviteId = "test-invite-id";
const mockOrganizationId = "test-org-id";
const mockCreatorId = "test-creator-id";
const mockInvite = {
  id: mockInviteId,
  email: "test@test.com",
  name: "Test Name",
  organizationId: mockOrganizationId,
  creatorId: mockCreatorId,
  acceptorId: null,
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  deprecatedRole: null,
  role: "member" as const,
  teamIds: ["team-1"],
  creator: {
    name: "Test Creator",
    email: "creator@test.com",
    locale: "en",
  },
};

// Mock prisma methods
vi.mock("@formbricks/database", () => ({
  prisma: {
    invite: {
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

// Mock cache
vi.mock("@/lib/cache/invite", () => ({
  inviteCache: {
    revalidate: vi.fn(),
    tag: {
      byId: (id: string) => `invite-${id}`,
    },
  },
}));

// Mock logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("Invite Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deleteInvite", () => {
    it("deletes an invite successfully and invalidates cache", async () => {
      vi.mocked(prisma.invite.delete).mockResolvedValue(mockInvite);

      const result = await deleteInvite(mockInviteId);

      expect(result).toBe(true);
      expect(prisma.invite.delete).toHaveBeenCalledWith({
        where: { id: mockInviteId },
        select: { id: true, organizationId: true },
      });
      expect(inviteCache.revalidate).toHaveBeenCalledWith({
        id: mockInviteId,
        organizationId: mockOrganizationId,
      });
    });

    it("throws DatabaseError when invite doesn't exist", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: PrismaErrorType.RecordDoesNotExist,
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.invite.delete).mockRejectedValue(errToThrow);

      await expect(deleteInvite(mockInviteId)).rejects.toThrow(DatabaseError);
    });

    it("throws DatabaseError for other Prisma errors", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.invite.delete).mockRejectedValue(errToThrow);

      await expect(deleteInvite(mockInviteId)).rejects.toThrow(DatabaseError);
    });

    it("throws DatabaseError for generic errors", async () => {
      vi.mocked(prisma.invite.delete).mockRejectedValue(new Error("Generic error"));

      await expect(deleteInvite(mockInviteId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getInvite", () => {
    it("retrieves an invite with creator details successfully", async () => {
      vi.mocked(prisma.invite.findUnique).mockResolvedValue(mockInvite);

      const result = await getInvite(mockInviteId);

      expect(result).toEqual(mockInvite);
      expect(prisma.invite.findUnique).toHaveBeenCalledWith({
        where: { id: mockInviteId },
        select: {
          id: true,
          organizationId: true,
          role: true,
          teamIds: true,
          creator: {
            select: {
              name: true,
              email: true,
              locale: true,
            },
          },
        },
      });
    });

    it("returns null when invite doesn't exist", async () => {
      vi.mocked(prisma.invite.findUnique).mockResolvedValue(null);

      const result = await getInvite(mockInviteId);

      expect(result).toBeNull();
    });

    it("throws DatabaseError on prisma error", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.invite.findUnique).mockRejectedValue(errToThrow);

      await expect(getInvite(mockInviteId)).rejects.toThrow(DatabaseError);
    });

    it("throws DatabaseError for generic errors", async () => {
      vi.mocked(prisma.invite.findUnique).mockRejectedValue(new Error("Generic error"));

      await expect(getInvite(mockInviteId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getIsValidInviteToken", () => {
    it("returns true for valid invite", async () => {
      vi.mocked(prisma.invite.findUnique).mockResolvedValue(mockInvite);

      const result = await getIsValidInviteToken(mockInviteId);

      expect(result).toBe(true);
      expect(prisma.invite.findUnique).toHaveBeenCalledWith({
        where: { id: mockInviteId },
      });
    });

    it("returns false when invite doesn't exist", async () => {
      vi.mocked(prisma.invite.findUnique).mockResolvedValue(null);

      const result = await getIsValidInviteToken(mockInviteId);

      expect(result).toBe(false);
    });

    it("returns false for expired invite", async () => {
      const expiredInvite = {
        ...mockInvite,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      };
      vi.mocked(prisma.invite.findUnique).mockResolvedValue(expiredInvite);

      const result = await getIsValidInviteToken(mockInviteId);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        {
          inviteId: mockInviteId,
          expiresAt: expiredInvite.expiresAt,
        },
        "SSO: Invite token expired"
      );
    });

    it("returns false and logs error when database error occurs", async () => {
      const error = new Error("Database error");
      vi.mocked(prisma.invite.findUnique).mockRejectedValue(error);

      const result = await getIsValidInviteToken(mockInviteId);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(error, "Error getting invite");
    });

    it("returns false for invite with null expiresAt", async () => {
      const invalidInvite = {
        ...mockInvite,
        expiresAt: null,
      };
      vi.mocked(prisma.invite.findUnique).mockResolvedValue(invalidInvite);

      const result = await getIsValidInviteToken(mockInviteId);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        {
          inviteId: mockInviteId,
          expiresAt: null,
        },
        "SSO: Invite token expired"
      );
    });

    it("returns false for invite with invalid expiresAt", async () => {
      const invalidInvite = {
        ...mockInvite,
        expiresAt: new Date("invalid-date"),
      };
      vi.mocked(prisma.invite.findUnique).mockResolvedValue(invalidInvite);

      const result = await getIsValidInviteToken(mockInviteId);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        {
          inviteId: mockInviteId,
          expiresAt: invalidInvite.expiresAt,
        },
        "SSO: Invite token expired"
      );
    });
  });
});
