import { teamCache } from "@/lib/cache/team";
import { TGetUsersFilter } from "@/modules/api/v2/organizations/[organizationId]/users/types/users";
import { describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { membershipCache } from "@formbricks/lib/membership/cache";
import { userCache } from "@formbricks/lib/user/cache";
import { createUser, getUsers, updateUser } from "../users";

const mockUser = {
  id: "user123",
  email: "test@example.com",
  name: "Test User",
  lastLoginAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  isActive: true,
  role: "admin",
  memberships: [{ organizationId: "org456", role: "admin" }],
  teamUsers: [{ team: { name: "Test Team", id: "team123", projectTeams: [{ projectId: "proj789" }] } }],
};

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.spyOn(membershipCache, "revalidate").mockImplementation(() => {});
vi.spyOn(userCache, "revalidate").mockImplementation(() => {});
vi.spyOn(teamCache, "revalidate").mockImplementation(() => {});

describe("Users Lib", () => {
  describe("getUsers", () => {
    it("returns users with meta on success", async () => {
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
      }
    });

    it("returns internal_server_error if prisma fails", async () => {
      (prisma.$transaction as any).mockRejectedValueOnce(new Error("Transaction error"));
      const result = await getUsers("org456", { limit: 10, skip: 0 } as TGetUsersFilter);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
      }
    });
  });

  describe("createUser", () => {
    it("creates user and revalidates caches", async () => {
      (prisma.user.create as any).mockResolvedValueOnce(mockUser);
      const result = await createUser(
        { name: "Test User", email: "test@example.com", role: "member" },
        "org456"
      );
      expect(prisma.user.create).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toBe(mockUser.id);
      }
    });

    it("returns internal_server_error if creation fails", async () => {
      (prisma.user.create as any).mockRejectedValueOnce(new Error("Create error"));
      const result = await createUser({ name: "fail", email: "fail@example.com", role: "manager" }, "org456");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
      }
    });
  });

  describe("updateUser", () => {
    it("updates user and revalidates caches", async () => {
      (prisma.user.findUnique as any).mockResolvedValueOnce(mockUser);
      (prisma.$transaction as any).mockResolvedValueOnce([{ ...mockUser, name: "Updated User" }]);
      const result = await updateUser({ email: mockUser.email, name: "Updated User" }, "org456");
      expect(prisma.user.findUnique).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe("Updated User");
      }
    });

    it("returns not_found if user doesn't exist", async () => {
      (prisma.user.findUnique as any).mockResolvedValueOnce(null);
      const result = await updateUser({ email: "unknown@example.com" }, "org456");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("not_found");
      }
    });

    it("returns internal_server_error if update fails", async () => {
      (prisma.user.findUnique as any).mockResolvedValueOnce(mockUser);
      (prisma.$transaction as any).mockRejectedValueOnce(new Error("Update error"));
      const result = await updateUser({ email: mockUser.email }, "org456");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
      }
    });
  });
});
