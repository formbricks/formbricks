import { OrganizationRole, Prisma } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { updateInvite } from "./invite";

vi.mock("@formbricks/database", () => ({
  prisma: {
    invite: {
      update: vi.fn(),
    },
  },
}));

describe("invite.ts", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("updateInvite", () => {
    test("should successfully update an invite", async () => {
      const mockInvite = {
        id: "invite-123",
        email: "test@example.com",
        name: "Test User",
        organizationId: "org-123",
        creatorId: "creator-123",
        acceptorId: null,
        createdAt: new Date(),
        expiresAt: new Date(),
        deprecatedRole: null,
        role: OrganizationRole.member,
        teamIds: [],
      };

      vi.mocked(prisma.invite.update).mockResolvedValue(mockInvite);

      const result = await updateInvite("invite-123", { role: "member" });

      expect(result).toBe(true);
      expect(prisma.invite.update).toHaveBeenCalledWith({
        where: { id: "invite-123" },
        data: { role: "member" },
      });
    });

    test("should throw ResourceNotFoundError when invite is null", async () => {
      vi.mocked(prisma.invite.update).mockResolvedValue(null as any);

      await expect(updateInvite("invite-123", { role: "member" })).rejects.toThrow(
        new ResourceNotFoundError("Invite", "invite-123")
      );
    });

    test("should throw ResourceNotFoundError when invite does not exist", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Record does not exist", {
        code: PrismaErrorType.RecordDoesNotExist,
        clientVersion: "1.0.0",
      });

      vi.mocked(prisma.invite.update).mockRejectedValue(prismaError);

      await expect(updateInvite("invite-123", { role: "member" })).rejects.toThrow(
        new ResourceNotFoundError("Invite", "invite-123")
      );
    });
  });
});
