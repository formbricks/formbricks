import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { verifyInviteToken } from "@/lib/jwt";
import { createMembership } from "@/lib/membership/service";
import { createTeamMembership } from "@/modules/auth/signup/lib/team";
import {
  copyInviteAttributeValuesToMembership,
  readInviteAttributeValues,
} from "@/modules/ee/member-attributes/lib/service";
import {
  InviteNoLongerValidError,
  acceptInviteInTransaction,
  getInvite,
  getIsValidInviteToken,
  resolveInviteMatch,
} from "./invite";

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
    $transaction: vi.fn(),
    invite: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/membership/service", () => ({ createMembership: vi.fn() }));
vi.mock("@/modules/auth/signup/lib/team", () => ({ createTeamMembership: vi.fn() }));
vi.mock("@/modules/ee/member-attributes/lib/service", () => ({
  copyInviteAttributeValuesToMembership: vi.fn(),
  readInviteAttributeValues: vi.fn(),
}));

// Mock logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/jwt", () => ({ verifyInviteToken: vi.fn() }));

describe("Invite Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("acceptInviteInTransaction", () => {
    const VALUES = [{ attributeKeyId: "key-1", value: "Berlin", normalizedValue: "berlin" }];
    const tx = { invite: { deleteMany: vi.fn() } };

    beforeEach(() => {
      vi.mocked(prisma.$transaction).mockImplementation((async (callback: (client: unknown) => unknown) =>
        callback(tx)) as never);
      vi.mocked(readInviteAttributeValues).mockResolvedValue(VALUES);
      tx.invite.deleteMany.mockResolvedValue({ count: 1 });
      vi.mocked(createTeamMembership).mockResolvedValue(["team-1"]);
    });

    // ENG-7468: the lock, the read, spending the invite, the membership and the copy share one transaction,
    // so a bulk write to the invite cannot be lost to its deletion, nor overtaken by the copy on the membership.
    test("locks and reads the invite's values, spends it, then writes the membership and copies on the same transaction", async () => {
      const result = await acceptInviteInTransaction(mockInvite, "user-1");

      expect(result).toEqual({ teamIds: ["team-1"] });
      expect(readInviteAttributeValues).toHaveBeenCalledWith(
        { inviteId: mockInviteId, organizationId: mockOrganizationId },
        tx
      );
      expect(tx.invite.deleteMany).toHaveBeenCalledWith({
        where: { id: mockInviteId, organizationId: mockOrganizationId, expiresAt: { gt: expect.any(Date) } },
      });
      expect(createMembership).toHaveBeenCalledWith(
        mockOrganizationId,
        "user-1",
        { accepted: true, role: "member" },
        { projection: "deferred", transaction: tx }
      );
      expect(createTeamMembership).toHaveBeenCalledWith(
        { organizationId: mockOrganizationId, role: "member", teamIds: ["team-1"] },
        "user-1",
        { projection: "deferred", transaction: tx }
      );
      expect(copyInviteAttributeValuesToMembership).toHaveBeenCalledWith({
        inviteId: mockInviteId,
        organizationId: mockOrganizationId,
        userId: "user-1",
        values: VALUES,
        transaction: tx,
      });

      const order = (fn: { mock: { invocationCallOrder: number[] } }) => fn.mock.invocationCallOrder[0];
      expect(order(vi.mocked(readInviteAttributeValues))).toBeLessThan(order(tx.invite.deleteMany));
      expect(order(tx.invite.deleteMany)).toBeLessThan(order(vi.mocked(createMembership)));
      expect(order(vi.mocked(createMembership))).toBeLessThan(
        order(vi.mocked(copyInviteAttributeValuesToMembership))
      );
    });

    test("writes no team memberships for an invite without teams", async () => {
      const result = await acceptInviteInTransaction({ ...mockInvite, teamIds: [] }, "user-1");

      expect(result).toEqual({ teamIds: [] });
      expect(createTeamMembership).not.toHaveBeenCalled();
    });

    test("rolls back without granting anything when the invite was spent or expired since it was checked", async () => {
      tx.invite.deleteMany.mockResolvedValue({ count: 0 });

      await expect(acceptInviteInTransaction(mockInvite, "user-1")).rejects.toBeInstanceOf(
        InviteNoLongerValidError
      );
      expect(createMembership).not.toHaveBeenCalled();
      expect(copyInviteAttributeValuesToMembership).not.toHaveBeenCalled();
    });
  });

  describe("getInvite", () => {
    test("retrieves an invite with creator details successfully", async () => {
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

    test("returns null when invite doesn't exist", async () => {
      vi.mocked(prisma.invite.findUnique).mockResolvedValue(null);

      const result = await getInvite(mockInviteId);

      expect(result).toBeNull();
    });

    test("throws DatabaseError on prisma error", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.invite.findUnique).mockRejectedValue(errToThrow);

      await expect(getInvite(mockInviteId)).rejects.toThrow(DatabaseError);
    });

    test("throws DatabaseError for generic errors", async () => {
      vi.mocked(prisma.invite.findUnique).mockRejectedValue(new Error("Generic error"));

      await expect(getInvite(mockInviteId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getIsValidInviteToken", () => {
    test("returns true for valid invite", async () => {
      vi.mocked(prisma.invite.findUnique).mockResolvedValue(mockInvite);

      const result = await getIsValidInviteToken(mockInviteId);

      expect(result).toBe(true);
      expect(prisma.invite.findUnique).toHaveBeenCalledWith({
        where: { id: mockInviteId },
      });
    });

    test("returns false when invite doesn't exist", async () => {
      vi.mocked(prisma.invite.findUnique).mockResolvedValue(null);

      const result = await getIsValidInviteToken(mockInviteId);

      expect(result).toBe(false);
    });

    test("returns false for expired invite", async () => {
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

    test("returns false and logs error when database error occurs", async () => {
      const error = new Error("Database error");
      vi.mocked(prisma.invite.findUnique).mockRejectedValue(error);

      const result = await getIsValidInviteToken(mockInviteId);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(error, "Error getting invite");
    });

    test("returns false for invite with null expiresAt", async () => {
      const invalidInvite = {
        ...mockInvite,
        expiresAt: null,
      };
      vi.mocked(prisma.invite.findUnique).mockResolvedValue(
        invalidInvite as unknown as Awaited<ReturnType<typeof prisma.invite.findUnique>>
      );

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

    test("returns false for invite with invalid expiresAt", async () => {
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

describe("resolveInviteMatch", () => {
  const token = "valid-jwt";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 'missing' when no token is provided (without verifying)", async () => {
    expect(await resolveInviteMatch(undefined, "user@acme.com")).toBe("missing");
    expect(await resolveInviteMatch("", "user@acme.com")).toBe("missing");
    expect(verifyInviteToken).not.toHaveBeenCalled();
  });

  test("returns 'email_mismatch' when the invite email differs, before checking validity", async () => {
    vi.mocked(verifyInviteToken).mockReturnValue({
      inviteId: mockInviteId,
      email: "other@acme.com",
    });
    expect(await resolveInviteMatch(token, "user@acme.com")).toBe("email_mismatch");
    expect(prisma.invite.findUnique).not.toHaveBeenCalled();
  });

  test("matches the email case- and whitespace-insensitively", async () => {
    vi.mocked(verifyInviteToken).mockReturnValue({ inviteId: mockInviteId, email: "User@Acme.com" });
    vi.mocked(prisma.invite.findUnique).mockResolvedValue(mockInvite);
    expect(await resolveInviteMatch(token, "  user@acme.COM  ")).toBe("valid");
  });

  test("returns 'invalid_or_expired' for an expired invite", async () => {
    vi.mocked(verifyInviteToken).mockReturnValue({
      inviteId: mockInviteId,
      email: mockInvite.email,
    });
    vi.mocked(prisma.invite.findUnique).mockResolvedValue({
      ...mockInvite,
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await resolveInviteMatch(token, mockInvite.email)).toBe("invalid_or_expired");
  });

  test("returns 'verification_error' and logs a warning when the token can't be verified", async () => {
    vi.mocked(verifyInviteToken).mockImplementation(() => {
      throw new Error("bad token");
    });
    expect(await resolveInviteMatch(token, "user@acme.com")).toBe("verification_error");
    expect(logger.warn).toHaveBeenCalled();
  });
});
