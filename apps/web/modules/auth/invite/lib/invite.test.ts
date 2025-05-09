import { inviteCache } from "@/lib/cache/invite";
import { type InviteWithCreator } from "@/modules/auth/invite/types/invites";
import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { deleteInvite, getInvite } from "./invite";

vi.mock("@formbricks/database", () => ({
  prisma: {
    invite: {
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/cache/invite", () => ({
  inviteCache: {
    revalidate: vi.fn(),
    tag: {
      byId: (id: string) => `invite-${id}`,
    },
  },
}));

describe("invite", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("deleteInvite", () => {
    test("should delete an invite and return true", async () => {
      const mockInvite = {
        id: "test-id",
        organizationId: "org-id",
      };

      vi.mocked(prisma.invite.delete).mockResolvedValue(mockInvite as any);

      const result = await deleteInvite("test-id");

      expect(result).toBe(true);
      expect(prisma.invite.delete).toHaveBeenCalledWith({
        where: { id: "test-id" },
        select: {
          id: true,
          organizationId: true,
        },
      });
      expect(inviteCache.revalidate).toHaveBeenCalledWith({
        id: "test-id",
        organizationId: "org-id",
      });
    });

    test("should throw ResourceNotFoundError when invite is not found", async () => {
      vi.mocked(prisma.invite.delete).mockResolvedValue(null as any);

      await expect(deleteInvite("test-id")).rejects.toThrow(ResourceNotFoundError);
    });

    test("should throw DatabaseError when Prisma throws an error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test error", {
        code: "P2002",
        clientVersion: "1.0.0",
      });

      vi.mocked(prisma.invite.delete).mockRejectedValue(prismaError);

      await expect(deleteInvite("test-id")).rejects.toThrow(DatabaseError);
    });
  });

  describe("getInvite", () => {
    test("should return invite with creator details", async () => {
      const mockInvite: InviteWithCreator = {
        id: "test-id",
        expiresAt: new Date(),
        organizationId: "org-id",
        role: "member",
        teamIds: ["team-1"],
        creator: {
          name: "Test User",
          email: "test@example.com",
        },
      };

      vi.mocked(prisma.invite.findUnique).mockResolvedValue(mockInvite);

      const result = await getInvite("test-id");

      expect(result).toEqual(mockInvite);
      expect(prisma.invite.findUnique).toHaveBeenCalledWith({
        where: { id: "test-id" },
        select: {
          id: true,
          expiresAt: true,
          organizationId: true,
          role: true,
          teamIds: true,
          creator: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });
    });

    test("should return null when invite is not found", async () => {
      vi.mocked(prisma.invite.findUnique).mockResolvedValue(null);

      const result = await getInvite("test-id");

      expect(result).toBeNull();
    });

    test("should throw DatabaseError when Prisma throws an error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test error", {
        code: "P2002",
        clientVersion: "1.0.0",
      });

      vi.mocked(prisma.invite.findUnique).mockRejectedValue(prismaError);

      await expect(getInvite("test-id")).rejects.toThrow(DatabaseError);
    });
  });
});
