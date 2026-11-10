import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { OrganizationRole, Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { updateInvite } from "./invite";

vi.mock("@formbricks/database", () => ({
  prisma: {
    invite: {
      findUnique: vi.fn(),
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

      const result = await updateInvite("invite-123", { role: "member" }, { allowOwnerInvite: true });

      expect(result).toBe(true);
      expect(prisma.invite.update).toHaveBeenCalledWith({
        where: { id: "invite-123" },
        data: { role: "member" },
      });
    });

    test("should throw ResourceNotFoundError when invite is null", async () => {
      vi.mocked(prisma.invite.update).mockResolvedValue(null as any);

      await expect(
        updateInvite("invite-123", { role: "member" }, { allowOwnerInvite: true })
      ).rejects.toThrow(new ResourceNotFoundError("Invite", "invite-123"));
    });

    test("should throw ResourceNotFoundError when invite does not exist", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Record does not exist", {
        code: PrismaErrorType.RecordNotFound,
        clientVersion: "1.0.0",
      });

      vi.mocked(prisma.invite.update).mockRejectedValue(prismaError);

      await expect(
        updateInvite("invite-123", { role: "member" }, { allowOwnerInvite: true })
      ).rejects.toThrow(new ResourceNotFoundError("Invite", "invite-123"));
    });

    describe("for a caller who is not an owner", () => {
      const recordNotFound = () =>
        new Prisma.PrismaClientKnownRequestError("Record does not exist", {
          code: PrismaErrorType.RecordNotFound,
          clientVersion: "1.0.0",
        });

      test("only updates the invite while it is not an owner invite", async () => {
        vi.mocked(prisma.invite.update).mockResolvedValue({ id: "invite-123" } as never);

        await expect(
          updateInvite("invite-123", { role: "member" }, { allowOwnerInvite: false })
        ).resolves.toBe(true);
        expect(prisma.invite.update).toHaveBeenCalledWith({
          where: { id: "invite-123", role: { not: "owner" } },
          data: { role: "member" },
        });
      });

      test("refuses an owner invite", async () => {
        vi.mocked(prisma.invite.update).mockRejectedValue(recordNotFound());
        vi.mocked(prisma.invite.findUnique).mockResolvedValue({ id: "invite-123" } as never);

        await expect(
          updateInvite("invite-123", { role: "member" }, { allowOwnerInvite: false })
        ).rejects.toThrow(OperationNotAllowedError);
      });

      test("reports a missing invite as not found", async () => {
        vi.mocked(prisma.invite.update).mockRejectedValue(recordNotFound());
        vi.mocked(prisma.invite.findUnique).mockResolvedValue(null);

        await expect(
          updateInvite("invite-123", { role: "member" }, { allowOwnerInvite: false })
        ).rejects.toThrow(new ResourceNotFoundError("Invite", "invite-123"));
      });
    });
  });
});
