import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma, type Team, type WorkspaceTeam } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { reconcileOrganizationMembership } from "@/lib/authzed/organization-membership";
import { reconcileTeamWorkspaceRelationships } from "@/lib/authzed/team-workspace";
import { lockUserActiveState, reactivateLockedUser } from "@/lib/user/reactivation";
import { TGetUsersFilter } from "@/modules/api/v2/organizations/[organizationId]/users/types/users";
import { createUser, getUsers, updateUser } from "../users";

const mockUser = {
  id: "user123",
  email: "test@example.com",
  name: "Test User",
  lastLoginAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  isActive: true,
  password: "$2b$12$hashedPassword",
  twoFactorSecret: "encrypted-2fa-secret",
  backupCodes: "encrypted-backup-codes",
  identityProviderAccountId: "provider-account-id",
  role: "admin",
  memberships: [{ organizationId: "org456", role: "admin" }],
  teamUsers: [{ team: { name: "Test Team", id: "team123", workspaceTeams: [{ workspaceId: "proj789" }] } }],
};

type TExistingTeam = Pick<Team, "id" | "name"> & {
  workspaceTeams: Pick<WorkspaceTeam, "workspaceId">[];
};

// getOrganizationOwnerCount (pulled in via the last-owner guard) request-caches its result with
// React's cache(); mocked to identity so repeated calls across tests re-hit the prisma mock below.
vi.mock("react", () => ({ cache: (fn: Function) => fn }));

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    team: {
      findMany: vi.fn(),
    },
    teamUser: {
      create: vi.fn(),
      delete: vi.fn(),
    },
    membership: {
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/authzed/organization-membership", () => ({
  reconcileOrganizationMembership: vi.fn(),
}));
vi.mock("@/lib/authzed/team-workspace", () => ({
  reconcileTeamWorkspaceRelationships: vi.fn(),
}));
vi.mock("@/lib/user/reactivation", () => ({
  lockUserActiveState: vi.fn(),
  reactivateLockedUser: vi.fn(),
}));

/** Run the interactive transaction against the mocked client, standing in for `tx`. */
const runInTransaction = () => {
  const options: unknown[] = [];
  vi.mocked(prisma.$transaction).mockImplementationOnce(((
    callback: (tx: typeof prisma) => unknown,
    given?: unknown
  ) => {
    options.push(given);
    return callback(prisma);
  }) as never);
  return options;
};

/** The account as `lockAndCheckAccountFields` reads it under the user row's lock. */
const lockedAccount = (account: { name?: string; isActive?: boolean; otherOrganizations?: string[] } = {}) =>
  vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValueOnce({
    name: account.name ?? mockUser.name,
    isActive: account.isActive ?? true,
    memberships: (account.otherOrganizations ?? []).map((organizationId) => ({ organizationId })),
  } as never);

describe("Users Lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUsers", () => {
    test("returns users with meta on success", async () => {
      const usersArray = [mockUser];
      (prisma.$transaction as any).mockResolvedValueOnce([usersArray, usersArray.length]);
      const result = await getUsers("org456", { limit: 10, skip: 0 } as TGetUsersFilter);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.data).toStrictEqual([
          {
            id: mockUser.id,
            email: mockUser.email,
            name: mockUser.name,
            lastLoginAt: expect.any(Date),
            isActive: true,
            role: mockUser.role,
            teams: ["Test Team"],
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        ]);
        expect(result.data.data[0]).not.toHaveProperty("password");
        expect(result.data.data[0]).not.toHaveProperty("twoFactorSecret");
        expect(result.data.data[0]).not.toHaveProperty("backupCodes");
        expect(result.data.data[0]).not.toHaveProperty("identityProviderAccountId");
      }
    });

    test("returns internal_server_error if prisma fails", async () => {
      (prisma.$transaction as any).mockRejectedValueOnce(new Error("Transaction error"));
      const result = await getUsers("org456", { limit: 10, skip: 0 } as TGetUsersFilter);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
      }
    });
  });

  describe("createUser", () => {
    test("creates user and revalidates caches", async () => {
      const existingTeams = [
        { id: "team123", name: "Test Team", workspaceTeams: [] },
      ] satisfies TExistingTeam[];

      vi.mocked(prisma.team.findMany).mockResolvedValueOnce(existingTeams as never);
      (prisma.user.create as any).mockResolvedValueOnce(mockUser);
      const result = await createUser(
        { name: "Test User", email: "test@example.com", role: "member", teams: ["Test Team"] },
        "org456"
      );
      expect(prisma.user.create).toHaveBeenCalled();
      expect(reconcileOrganizationMembership).toHaveBeenCalledWith("org456", mockUser.id);
      expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledWith({
        teamMemberships: [{ teamId: "team123", userId: mockUser.id }],
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toBe(mockUser.id);
        expect(result.data).not.toHaveProperty("password");
        expect(result.data).not.toHaveProperty("twoFactorSecret");
        expect(result.data).not.toHaveProperty("backupCodes");
        expect(result.data).not.toHaveProperty("identityProviderAccountId");
      }
    });

    test("returns internal_server_error if creation fails", async () => {
      (prisma.user.create as any).mockRejectedValueOnce(new Error("Create error"));
      const result = await createUser({ name: "fail", email: "fail@example.com", role: "manager" }, "org456");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
      }
    });

    test("returns conflict error if user with email already exists", async () => {
      // Real Prisma 7 + adapter-pg P2002 shape: NO meta.target; columns nested under
      // driverAdapterError.cause.constraint.fields. This is the shape that shipped the 500 bug.
      (prisma.user.create as any).mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: PrismaErrorType.UniqueConstraintViolation,
          clientVersion: "1.0.0",
          meta: {
            modelName: "User",
            driverAdapterError: {
              name: "DriverAdapterError",
              cause: { kind: "UniqueConstraintViolation", constraint: { fields: ["email"] } },
            },
          },
        })
      );
      const result = await createUser(
        { name: "Duplicate", email: "test@example.com", role: "member" },
        "org456"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("conflict");
        expect(result.error.details).toEqual([
          { field: "email", issue: "A user with this email already exists" },
        ]);
      }
    });

    test("maps a driver-adapter P2002 with no recoverable fields to conflict, never 500 (ENG-1801)", async () => {
      // Degrade-safe: even when neither meta.target nor constraint.fields is present, a P2002 on
      // this create (email is the only unique key) must return 409, not fall through to a 500.
      (prisma.user.create as any).mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: PrismaErrorType.UniqueConstraintViolation,
          clientVersion: "1.0.0",
          meta: { modelName: "User", driverAdapterError: { cause: { kind: "UniqueConstraintViolation" } } },
        })
      );
      const result = await createUser(
        { name: "Duplicate", email: "test@example.com", role: "member" },
        "org456"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("conflict");
      }
    });
  });

  describe("updateUser", () => {
    test("updates user and revalidates caches", async () => {
      runInTransaction();
      (prisma.user.findFirst as any).mockResolvedValueOnce(mockUser);
      lockedAccount();
      vi.mocked(prisma.user.update).mockResolvedValueOnce({ ...mockUser, name: "Updated User" } as never);
      const result = await updateUser({ email: mockUser.email, name: "Updated User" }, "org456");
      expect(prisma.user.findFirst).toHaveBeenCalled();
      expect(reconcileOrganizationMembership).toHaveBeenCalledWith("org456", mockUser.id);
      expect(reconcileTeamWorkspaceRelationships).toHaveBeenCalledWith({
        teamMemberships: [{ teamId: "team123", userId: mockUser.id }],
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe("Updated User");
        expect(result.data).not.toHaveProperty("password");
        expect(result.data).not.toHaveProperty("twoFactorSecret");
        expect(result.data).not.toHaveProperty("backupCodes");
        expect(result.data).not.toHaveProperty("identityProviderAccountId");
      }
    });

    test("returns not_found if user doesn't exist", async () => {
      (prisma.user.findFirst as any).mockResolvedValueOnce(null);
      const result = await updateUser({ email: "unknown@example.com" }, "org456");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("not_found");
      }
    });

    test("scopes the lookup to a membership in the authenticated organization", async () => {
      (prisma.user.findFirst as any).mockResolvedValueOnce(null);

      const result = await updateUser(
        { email: "outsider@example.com", isActive: false, teams: [] },
        "org456"
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("not_found");
      }

      // The lookup MUST filter by both email and an organization membership; otherwise a
      // caller could mutate a user that belongs only to another organization.
      const lookupArgs = (prisma.user.findFirst as any).mock.calls[0]?.[0];
      expect(lookupArgs?.where).toEqual({
        email: "outsider@example.com",
        memberships: { some: { organizationId: "org456" } },
      });
      // No write should happen when the user is not in the caller's organization.
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    test("only loads teamUsers for the authenticated organization", async () => {
      (prisma.user.findFirst as any).mockResolvedValueOnce({
        ...mockUser,
        teamUsers: [],
      });
      (prisma.team.findMany as any).mockResolvedValueOnce([]);
      (prisma.$transaction as any).mockResolvedValueOnce([{ ...mockUser, name: mockUser.name }]);

      await updateUser({ email: mockUser.email, teams: [] }, "org456");

      const lookupArgs = (prisma.user.findFirst as any).mock.calls[0]?.[0];
      expect(lookupArgs?.include?.teamUsers).toMatchObject({
        where: { team: { organizationId: "org456" } },
      });
    });

    test("updates the user by id rather than email", async () => {
      (prisma.user.findFirst as any).mockResolvedValueOnce({
        ...mockUser,
        teamUsers: [],
      });
      runInTransaction();
      lockedAccount();
      vi.mocked(prisma.user.update).mockResolvedValueOnce({ ...mockUser, name: "Renamed" } as never);

      await updateUser({ email: mockUser.email, name: "Renamed" }, "org456");

      // Find the user.update call inside the transaction args.
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: mockUser.id } })
      );
      // The email it was found by is never written back: it is the account's, not this organization's.
      expect(vi.mocked(prisma.user.update).mock.calls[0][0].data).not.toHaveProperty("email");
    });

    test("returns internal_server_error if update fails", async () => {
      (prisma.user.findFirst as any).mockResolvedValueOnce(mockUser);
      (prisma.$transaction as any).mockRejectedValueOnce(new Error("Update error"));
      const result = await updateUser({ email: mockUser.email }, "org456");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
      }
    });

    test("blocks demoting the organization's last owner", async () => {
      // The re-check runs inside the transaction, so the mock has to actually invoke the
      // callback (against the same mocked client, standing in for `tx`) for the guard to run.
      (prisma.$transaction as any).mockImplementationOnce((callback: any) => callback(prisma));
      (prisma.user.findFirst as any).mockResolvedValueOnce({
        ...mockUser,
        memberships: [{ organizationId: "org456", role: "owner" }],
      });
      (prisma.membership.count as any).mockResolvedValueOnce(1);

      const result = await updateUser({ email: mockUser.email, role: "member" }, "org456");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("conflict");
      }
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    test("allows demoting an owner when the organization has another owner", async () => {
      (prisma.$transaction as any).mockImplementationOnce((callback: any) => callback(prisma));
      (prisma.user.findFirst as any).mockResolvedValueOnce({
        ...mockUser,
        memberships: [{ organizationId: "org456", role: "owner" }],
        teamUsers: [],
      });
      (prisma.membership.count as any).mockResolvedValueOnce(2);
      (prisma.team.findMany as any).mockResolvedValueOnce([]);
      (prisma.user.update as any).mockResolvedValueOnce({
        ...mockUser,
        memberships: [{ organizationId: "org456", role: "member" }],
      });

      const result = await updateUser({ email: mockUser.email, role: "member" }, "org456");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.role).toBe("member");
      }
    });

    test("allows demoting an already-inactive owner without checking the owner count", async () => {
      (prisma.user.findFirst as any).mockResolvedValueOnce({
        ...mockUser,
        isActive: false,
        memberships: [{ organizationId: "org456", role: "owner" }],
        teamUsers: [],
      });
      (prisma.team.findMany as any).mockResolvedValueOnce([]);
      (prisma.$transaction as any).mockResolvedValueOnce([
        { ...mockUser, isActive: false, memberships: [{ organizationId: "org456", role: "member" }] },
      ]);

      const result = await updateUser({ email: mockUser.email, role: "member" }, "org456");

      expect(result.ok).toBe(true);
      expect(prisma.membership.count).not.toHaveBeenCalled();
    });
  });

  describe("updateUser reactivating a user", () => {
    const inactiveUser = { ...mockUser, isActive: false, teamUsers: [] };
    const lookup = (user: typeof inactiveUser) =>
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(user as never);

    test("turns an inactive account back on through the shared reactivation, in the same transaction", async () => {
      const options = runInTransaction();
      lookup(inactiveUser);
      lockedAccount({ isActive: false });
      vi.mocked(prisma.user.update).mockResolvedValueOnce({ ...mockUser, isActive: true } as never);

      const result = await updateUser({ email: mockUser.email, isActive: true }, "org456");

      expect(result.ok).toBe(true);
      // Decided under the user row's lock, then the clock restarts and the members notices go, so the
      // sweep doesn't deactivate them again the next night without a warning.
      expect(lockUserActiveState).toHaveBeenCalledWith(prisma, mockUser.id);
      expect(reactivateLockedUser).toHaveBeenCalledWith(prisma, mockUser.id);
      expect(vi.mocked(reactivateLockedUser).mock.invocationCallOrder[0]).toBeGreaterThan(
        vi.mocked(prisma.user.update).mock.invocationCallOrder[0]
      );
      // No owner is being demoted, so no serializable isolation.
      expect(options).toEqual([undefined]);
    });

    test("restarts nothing for an account that is already active under the lock", async () => {
      runInTransaction();
      lookup(inactiveUser);
      lockedAccount({ isActive: true });
      vi.mocked(prisma.user.update).mockResolvedValueOnce({ ...mockUser, isActive: true } as never);

      await expect(updateUser({ email: mockUser.email, isActive: true }, "org456")).resolves.toMatchObject({
        ok: true,
      });
      expect(reactivateLockedUser).not.toHaveBeenCalled();
    });

    test("never reactivates for any other update", async () => {
      runInTransaction();
      lookup(inactiveUser);
      lockedAccount({ isActive: false });
      vi.mocked(prisma.user.update).mockResolvedValueOnce({ ...mockUser, isActive: false } as never);

      await updateUser({ email: mockUser.email, isActive: false }, "org456");

      expect(reactivateLockedUser).not.toHaveBeenCalled();
    });
  });

  describe("updateUser on a user who also belongs to other organizations", () => {
    test("decides under the user row's lock, counting only other organizations' memberships", async () => {
      runInTransaction();
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ ...mockUser, teamUsers: [] } as never);
      lockedAccount({ otherOrganizations: ["org789"] });

      const result = await updateUser({ email: mockUser.email, isActive: false, name: "Other" }, "org456");

      expect(result).toMatchObject({
        ok: false,
        error: {
          type: "conflict",
          details: [{ field: "isActive" }, { field: "name" }],
        },
      });
      expect(lockUserActiveState).toHaveBeenCalledWith(prisma, mockUser.id);
      expect(vi.mocked(lockUserActiveState).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(prisma.user.findUniqueOrThrow).mock.invocationCallOrder[0]
      );
      expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          select: expect.objectContaining({
            memberships: expect.objectContaining({ where: { organizationId: { not: "org456" } } }),
          }),
        })
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(reconcileOrganizationMembership).not.toHaveBeenCalled();
    });

    test("demotes an owner and changes their account fields in one Serializable transaction", async () => {
      const options = runInTransaction();
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        ...mockUser,
        memberships: [{ organizationId: "org456", role: "owner" }],
        teamUsers: [],
      } as never);
      lockedAccount();
      vi.mocked(prisma.membership.count).mockResolvedValueOnce(2);
      vi.mocked(prisma.user.update).mockResolvedValueOnce({
        ...mockUser,
        name: "Renamed",
        memberships: [{ organizationId: "org456", role: "member" }],
      } as never);

      const result = await updateUser({ email: mockUser.email, role: "member", name: "Renamed" }, "org456");

      expect(result.ok).toBe(true);
      expect(options).toEqual([{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }]);
      expect(lockUserActiveState).toHaveBeenCalledWith(prisma, mockUser.id);
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
    });

    test("lets the stored values through unchanged", async () => {
      runInTransaction();
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ ...mockUser, teamUsers: [] } as never);
      lockedAccount({ otherOrganizations: ["org789"] });
      vi.mocked(prisma.user.update).mockResolvedValueOnce(mockUser as never);

      const result = await updateUser(
        { email: mockUser.email, isActive: true, name: mockUser.name, role: "member" },
        "org456"
      );

      expect(result.ok).toBe(true);
    });
  });

  describe("createUser with teams", () => {
    test("creates user with existing teams", async () => {
      (prisma.team.findMany as any).mockResolvedValueOnce([
        { id: "team123", name: "MyTeam", workspaceTeams: [{ workspaceId: "proj789" }] },
      ]);
      (prisma.user.create as any).mockResolvedValueOnce({
        ...mockUser,
        teamUsers: [{ team: { id: "team123", name: "MyTeam" } }],
      });

      const result = await createUser(
        { name: "Test", email: "team@example.com", role: "manager", teams: ["MyTeam"], isActive: true },
        "org456"
      );

      expect(prisma.user.create).toHaveBeenCalled();
      expect(result.ok).toBe(true);
    });
  });

  describe("updateUser with team changes", () => {
    test("removes a team and adds new team", async () => {
      (prisma.user.findFirst as any).mockResolvedValueOnce({
        ...mockUser,
        teamUsers: [
          { team: { id: "team123", name: "OldTeam", workspaceTeams: [{ workspaceId: "proj789" }] } },
        ],
      });
      (prisma.team.findMany as any).mockResolvedValueOnce([
        { id: "team456", name: "NewTeam", workspaceTeams: [] },
      ]);
      runInTransaction();
      lockedAccount();
      vi.mocked(prisma.user.update).mockResolvedValueOnce({ ...mockUser, name: "Updated Name" } as never);

      const result = await updateUser(
        { email: mockUser.email, name: "Updated Name", teams: ["NewTeam"] },
        "org456"
      );

      expect(prisma.user.findFirst).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.teams).toContain("NewTeam");
        expect(result.data.name).toBe("Updated Name");
      }
    });
  });
});
