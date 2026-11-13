import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError, UnknownError, ValidationError } from "@formbricks/types/errors";
import { reconcileOrganizationMembership } from "@/lib/authzed/organization-membership";
import { reconcileTeamWorkspaceRelationships } from "@/lib/authzed/team-workspace";
import { revokeAllUserOAuthGrants } from "@/modules/auth/lib/oauth-grant-revocation";
import {
  deleteMembership,
  getMembersByOrganizationId,
  getMembershipByOrganizationId,
  getMembershipsByUserId,
} from "./membership";

vi.mock("@formbricks/database", () => ({
  prisma: {
    membership: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    teamUser: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    invite: {
      updateMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/constants", () => ({ ITEMS_PER_PAGE: 2 }));
vi.mock("@/lib/utils/validate", () => ({ validateInputs: vi.fn() }));
vi.mock("react", () => ({ cache: (fn: Function) => fn }));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/authzed/organization-membership", () => ({
  reconcileOrganizationMembership: vi.fn(),
}));
vi.mock("@/lib/authzed/team-workspace", () => ({
  reconcileTeamWorkspaceRelationships: vi.fn(),
}));
vi.mock("@/modules/auth/lib/oauth-grant-revocation", () => ({ revokeAllUserOAuthGrants: vi.fn() }));

const organizationId = "org-1";
const userId = "user-1";
const teamId = "team-1";
const mockMember = {
  user: { name: "Test", email: "test@example.com", isActive: true, lastLoginAt: new Date("2026-09-01") },
  userId,
  organizationId,
  accepted: true,
  role: "member" as const,
};
const mockMembership = { userId, organizationId, role: "member" as const, accepted: true };
const mockTeamMembership = {
  userId,
  role: "contributor" as const,
  teamId,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("getMembershipByOrganizationId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("returns members", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue([mockMember]);
    const result = await getMembershipByOrganizationId(organizationId, 1);
    expect(result[0].userId).toBe(userId);
    expect(result[0].name).toBe("Test");
    expect(result[0].email).toBe("test@example.com");
    expect(result[0].isActive).toBe(true);
    expect(result[0].lastLoginAt).toEqual(new Date("2026-09-01"));
  });
  test("throws DatabaseError on prisma error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("db", {
      code: "P2002",
      clientVersion: "1.0.0",
    });
    vi.mocked(prisma.membership.findMany).mockRejectedValue(prismaError);
    await expect(getMembershipByOrganizationId(organizationId, 1)).rejects.toThrow(DatabaseError);
  });
  test("throws UnknownError on unknown error", async () => {
    vi.mocked(prisma.membership.findMany).mockRejectedValue({});
    await expect(getMembershipByOrganizationId(organizationId, 1)).rejects.toThrow(UnknownError);
  });
});

describe("deleteMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (transaction) => {
      if (typeof transaction !== "function") {
        throw new Error("Expected an interactive transaction");
      }

      return transaction(prisma as never);
    });
    vi.mocked(prisma.membership.delete).mockResolvedValue({ role: "member" } as never);
    vi.mocked(prisma.membership.findMany).mockResolvedValue([]);
  });
  test("deletes membership and returns deleted team memberships", async () => {
    vi.mocked(prisma.teamUser.findMany).mockResolvedValue([mockTeamMembership]);
    const result = await deleteMembership(userId, organizationId);
    expect(result[0].teamId).toBe(teamId);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(prisma.teamUser.deleteMany).toHaveBeenCalledWith({
      where: {
        userId,
        team: {
          organizationId,
        },
      },
    });
    expect(prisma.membership.delete).toHaveBeenCalledWith({
      where: {
        userId_organizationId: {
          organizationId,
          userId,
        },
      },
      select: { role: true },
    });
    expect(reconcileOrganizationMembership).toHaveBeenCalledWith(organizationId, userId);
    expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledWith({
      teamMemberships: [{ teamId, userId }],
    });
  });
  test.each([
    ["the last non-viewer membership goes and only viewer ones remain", "member", ["dashboard_viewer"], true],
    ["another non-viewer membership remains", "member", ["dashboard_viewer", "owner"], false],
    ["no membership remains", "member", [], false],
    ["the removed membership was itself a viewer one", "dashboard_viewer", ["dashboard_viewer"], false],
  ] as const)(
    "revokes the user's OAuth grants in the transaction only when %s (S13)",
    async (_label, removedRole, remainingRoles, revokes) => {
      vi.mocked(prisma.teamUser.findMany).mockResolvedValue([]);
      vi.mocked(prisma.membership.delete).mockResolvedValue({
        ...mockMembership,
        role: removedRole,
      } as never);
      vi.mocked(prisma.membership.findMany).mockResolvedValue(
        remainingRoles.map((role) => ({ role })) as never
      );

      await deleteMembership(userId, organizationId);

      if (revokes) {
        expect(revokeAllUserOAuthGrants).toHaveBeenCalledWith(prisma, userId);
      } else {
        expect(revokeAllUserOAuthGrants).not.toHaveBeenCalled();
      }
    }
  );
  test("expires the removed member's pending invites in that organization", async () => {
    const now = new Date("2026-10-08T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      vi.mocked(prisma.teamUser.findMany).mockResolvedValue([]);

      await deleteMembership(userId, organizationId);

      expect(prisma.invite.updateMany).toHaveBeenCalledWith({
        where: { organizationId, creatorId: userId, expiresAt: { gt: now } },
        data: { expiresAt: now },
      });
    } finally {
      vi.useRealTimers();
    }
  });
  test("retries a transaction conflict up to a successful attempt", async () => {
    const transactionConflict = new Prisma.PrismaClientKnownRequestError("transaction conflict", {
      code: PrismaErrorType.TransactionConflict,
      clientVersion: "1.0.0",
    });
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(transactionConflict);
    vi.mocked(prisma.teamUser.findMany).mockResolvedValue([mockTeamMembership]);

    await expect(deleteMembership(userId, organizationId)).resolves.toEqual([mockTeamMembership]);

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(reconcileOrganizationMembership).toHaveBeenCalledTimes(1);
    expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledTimes(1);
  });
  test("stops retrying a transaction conflict after three attempts", async () => {
    const transactionConflict = new Prisma.PrismaClientKnownRequestError("transaction conflict", {
      code: PrismaErrorType.TransactionConflict,
      clientVersion: "1.0.0",
    });
    vi.mocked(prisma.$transaction).mockRejectedValue(transactionConflict);

    await expect(deleteMembership(userId, organizationId)).rejects.toThrow(DatabaseError);

    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(reconcileOrganizationMembership).not.toHaveBeenCalled();
    expect(reconcileTeamWorkspaceRelationships).not.toHaveBeenCalled();
  });
  test("throws DatabaseError on prisma error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("db", {
      code: "P2002",
      clientVersion: "1.0.0",
    });
    vi.mocked(prisma.teamUser.findMany).mockRejectedValue(prismaError);
    await expect(deleteMembership(userId, organizationId)).rejects.toThrow(DatabaseError);
  });
  test("throws original error on unknown error", async () => {
    vi.mocked(prisma.teamUser.findMany).mockRejectedValue({});
    await expect(deleteMembership(userId, organizationId)).rejects.toThrowError();
  });

  // The last-owner guard used to be a cached count read in the action, before the delete's transaction,
  // so two owners removed at once could both pass it.
  describe("last-owner guard", () => {
    const owner = (isActive: boolean) => ({ role: "owner" as const, user: { isActive } });

    test("refuses to delete the only active owner, reading the count inside the transaction", async () => {
      // A transaction client of its own, so a guard read outside the transaction would miss these.
      const tx = {
        membership: {
          findUnique: vi.fn().mockResolvedValue(owner(true)),
          count: vi.fn().mockResolvedValue(1),
          delete: vi.fn(),
        },
        teamUser: { findMany: vi.fn(), deleteMany: vi.fn() },
        invite: { updateMany: vi.fn() },
        $queryRaw: vi.fn(),
      };
      vi.mocked(prisma.$transaction).mockImplementation(async (transaction) =>
        (transaction as (client: unknown) => unknown)(tx)
      );

      await expect(deleteMembership(userId, organizationId)).rejects.toThrow(ValidationError);

      expect(prisma.membership.count).not.toHaveBeenCalled();
      expect(tx.membership.delete).not.toHaveBeenCalled();
      expect(tx.membership.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId, role: "owner" }) })
      );
      // The owners are locked before the target and the count are read, so a concurrent owner change has
      // committed by then (proven against real Postgres in last-owner-race.integration.test.ts).
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.membership.findUnique.mock.invocationCallOrder[0]
      );
      expect(prisma.membership.delete).not.toHaveBeenCalled();
      expect(reconcileOrganizationMembership).not.toHaveBeenCalled();
    });

    test("deletes an owner while another active owner remains", async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(owner(true) as never);
      vi.mocked(prisma.membership.count).mockResolvedValue(2);
      vi.mocked(prisma.teamUser.findMany).mockResolvedValue([]);

      await expect(deleteMembership(userId, organizationId)).resolves.toEqual([]);
      expect(prisma.membership.delete).toHaveBeenCalled();
    });

    test("deletes a deactivated owner when the one active owner is someone else", async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(owner(false) as never);
      vi.mocked(prisma.membership.count).mockResolvedValue(1);
      vi.mocked(prisma.teamUser.findMany).mockResolvedValue([]);

      await expect(deleteMembership(userId, organizationId)).resolves.toEqual([]);
      expect(prisma.membership.delete).toHaveBeenCalled();
    });

    test("retries a conflict raised by the owner count, instead of wrapping it", async () => {
      const conflict = new Prisma.PrismaClientKnownRequestError("conflict", {
        code: PrismaErrorType.TransactionConflict,
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(owner(true) as never);
      vi.mocked(prisma.membership.count).mockRejectedValueOnce(conflict).mockResolvedValueOnce(2);
      vi.mocked(prisma.teamUser.findMany).mockResolvedValue([]);

      await expect(deleteMembership(userId, organizationId)).resolves.toEqual([]);
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    test("does not count owners when removing a non-owner", async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue({
        role: "member",
        user: { isActive: true },
      } as never);
      vi.mocked(prisma.teamUser.findMany).mockResolvedValue([]);

      await deleteMembership(userId, organizationId);
      expect(prisma.membership.count).not.toHaveBeenCalled();
    });
  });
});

describe("getMembershipsByUserId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("returns memberships", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue([mockMembership]);
    const result = await getMembershipsByUserId(userId, 1);
    expect(result[0].userId).toBe(userId);
    expect(result[0].organizationId).toBe(organizationId);
  });
  test("throws DatabaseError on prisma error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("db", {
      code: "P2002",
      clientVersion: "1.0.0",
    });
    vi.mocked(prisma.membership.findMany).mockRejectedValue(prismaError);
    await expect(getMembershipsByUserId(userId, 1)).rejects.toThrow(DatabaseError);
  });

  test("throws UnknownError on unknown error", async () => {
    vi.mocked(prisma.membership.findMany).mockRejectedValue(new Error("unknown"));
    await expect(getMembershipsByUserId(userId, 1)).rejects.toThrow(Error);
  });
});

describe("getMembersByOrganizationId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("returns members", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue([
      { user: { name: "Test" }, role: "member", userId },
    ] as unknown as Awaited<ReturnType<typeof prisma.membership.findMany>>);
    const result = await getMembersByOrganizationId(organizationId);
    expect(result[0].id).toBe(userId);
    expect(result[0].name).toBe("Test");
    expect(result[0].role).toBe("member");
  });
  test("throws DatabaseError on prisma error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("db", {
      code: "P2002",
      clientVersion: "1.0.0",
    });
    vi.mocked(prisma.membership.findMany).mockRejectedValue(prismaError);
    await expect(getMembersByOrganizationId(organizationId)).rejects.toThrow(DatabaseError);
  });
  test("throws original on unknown error", async () => {
    vi.mocked(prisma.membership.findMany).mockRejectedValue(new Error("unknown"));
    await expect(getMembersByOrganizationId(organizationId)).rejects.toThrow(Error);
  });
});
