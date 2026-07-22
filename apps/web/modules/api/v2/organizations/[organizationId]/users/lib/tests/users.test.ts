import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
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

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
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
    $transaction: vi.fn(),
  },
}));

describe("Users Lib", () => {
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
      (prisma.user.create as any).mockResolvedValueOnce(mockUser);
      const result = await createUser(
        { name: "Test User", email: "test@example.com", role: "member" },
        "org456"
      );
      expect(prisma.user.create).toHaveBeenCalled();
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
      (prisma.user.findFirst as any).mockResolvedValueOnce(mockUser);
      (prisma.$transaction as any).mockResolvedValueOnce([{ ...mockUser, name: "Updated User" }]);
      const result = await updateUser({ email: mockUser.email, name: "Updated User" }, "org456");
      expect(prisma.user.findFirst).toHaveBeenCalled();
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
      (prisma.team.findMany as any).mockResolvedValueOnce([]);
      (prisma.$transaction as any).mockResolvedValueOnce([{ ...mockUser, name: "Renamed" }]);

      await updateUser({ email: mockUser.email, name: "Renamed" }, "org456");

      // Find the user.update call inside the transaction args.
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: mockUser.id } })
      );
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
      (prisma.$transaction as any).mockResolvedValueOnce([
        // deleted OldTeam from user
        { team: { id: "team123", name: "OldTeam", workspaceTeams: [{ workspaceId: "proj789" }] } },
        // created teamUsers for NewTeam
        {
          team: { id: "team456", name: "NewTeam", workspaceTeams: [] },
        },
        // updated user
        { ...mockUser, name: "Updated Name" },
      ]);

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
