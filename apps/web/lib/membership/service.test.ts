import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";
import { TMembership } from "@formbricks/types/memberships";
import { createMembership, getMembershipByUserIdOrganizationId, getMembershipsByUserId } from "./service";

vi.mock("@formbricks/database", () => ({
  prisma: {
    membership: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("Membership Service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getMembershipByUserIdOrganizationId", () => {
    const mockUserId = "user123";
    const mockOrgId = "org123";

    test("returns membership when found", async () => {
      const mockMembership: TMembership = {
        organizationId: mockOrgId,
        userId: mockUserId,
        accepted: true,
        role: "owner",
      };

      vi.mocked(prisma.membership.findUnique).mockResolvedValue(mockMembership);

      const result = await getMembershipByUserIdOrganizationId(mockUserId, mockOrgId);
      expect(result).toEqual(mockMembership);
      expect(prisma.membership.findUnique).toHaveBeenCalledWith({
        where: {
          userId_organizationId: {
            userId: mockUserId,
            organizationId: mockOrgId,
          },
        },
      });
    });

    test("returns null when membership not found", async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

      const result = await getMembershipByUserIdOrganizationId(mockUserId, mockOrgId);
      expect(result).toBeNull();
    });

    test("throws DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.membership.findUnique).mockRejectedValue(prismaError);

      await expect(getMembershipByUserIdOrganizationId(mockUserId, mockOrgId)).rejects.toThrow(DatabaseError);
    });

    test("throws UnknownError on unknown error", async () => {
      vi.mocked(prisma.membership.findUnique).mockRejectedValue(new Error("Unknown error"));

      await expect(getMembershipByUserIdOrganizationId(mockUserId, mockOrgId)).rejects.toThrow(UnknownError);
    });

    test("uses the transaction client directly when provided", async () => {
      const mockMembership: TMembership = {
        organizationId: mockOrgId,
        userId: mockUserId,
        accepted: true,
        role: "owner",
      };
      const tx = {
        membership: {
          findUnique: vi.fn().mockResolvedValue(mockMembership),
        },
      } as any;

      const result = await getMembershipByUserIdOrganizationId(mockUserId, mockOrgId, tx);

      expect(result).toEqual(mockMembership);
      expect(tx.membership.findUnique).toHaveBeenCalledWith({
        where: {
          userId_organizationId: {
            userId: mockUserId,
            organizationId: mockOrgId,
          },
        },
      });
      expect(prisma.membership.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("getMembershipsByUserId", () => {
    const mockUserId = "user123";

    test("returns every membership for the user", async () => {
      const mockMemberships: TMembership[] = [
        { organizationId: "org1", userId: mockUserId, accepted: true, role: "owner" },
        { organizationId: "org2", userId: mockUserId, accepted: true, role: "member" },
      ];

      vi.mocked(prisma.membership.findMany).mockResolvedValue(mockMemberships);

      const result = await getMembershipsByUserId(mockUserId);
      expect(result).toEqual(mockMemberships);
      expect(prisma.membership.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
    });

    test("returns an empty array when the user has no memberships", async () => {
      vi.mocked(prisma.membership.findMany).mockResolvedValue([]);

      const result = await getMembershipsByUserId(mockUserId);
      expect(result).toEqual([]);
    });

    test("throws DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.membership.findMany).mockRejectedValue(prismaError);

      await expect(getMembershipsByUserId(mockUserId)).rejects.toThrow(DatabaseError);
    });

    test("throws UnknownError on unknown error", async () => {
      vi.mocked(prisma.membership.findMany).mockRejectedValue(new Error("Unknown error"));

      await expect(getMembershipsByUserId(mockUserId)).rejects.toThrow(UnknownError);
    });
  });

  describe("createMembership", () => {
    const mockUserId = "user123";
    const mockOrgId = "org123";
    const mockMembershipData: Partial<TMembership> = {
      accepted: true,
      role: "member",
    };

    test("creates new membership when none exists", async () => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

      const mockCreatedMembership = {
        organizationId: mockOrgId,
        userId: mockUserId,
        accepted: true,
        role: "member",
      } as TMembership;

      vi.mocked(prisma.membership.create).mockResolvedValue(mockCreatedMembership as any);

      const result = await createMembership(mockOrgId, mockUserId, mockMembershipData);
      expect(result).toEqual(mockCreatedMembership);
      expect(prisma.membership.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          organizationId: mockOrgId,
          accepted: mockMembershipData.accepted,
          role: mockMembershipData.role,
        },
      });
    });

    test("returns existing membership if role matches", async () => {
      const existingMembership = {
        organizationId: mockOrgId,
        userId: mockUserId,
        accepted: true,
        role: "member",
      } as TMembership;

      vi.mocked(prisma.membership.findUnique).mockResolvedValue(existingMembership as any);

      const result = await createMembership(mockOrgId, mockUserId, mockMembershipData);
      expect(result).toEqual(existingMembership);
      expect(prisma.membership.create).not.toHaveBeenCalled();
      expect(prisma.membership.update).not.toHaveBeenCalled();
    });

    test("updates existing membership if role differs", async () => {
      const existingMembership = {
        organizationId: mockOrgId,
        userId: mockUserId,
        accepted: true,
        role: "member",
      } as TMembership;

      const updatedMembership = {
        ...existingMembership,
        role: "owner",
      } as TMembership;

      vi.mocked(prisma.membership.findUnique).mockResolvedValue(existingMembership as any);
      vi.mocked(prisma.membership.update).mockResolvedValue(updatedMembership as any);

      const result = await createMembership(mockOrgId, mockUserId, { ...mockMembershipData, role: "owner" });
      expect(result).toEqual(updatedMembership);
      expect(prisma.membership.update).toHaveBeenCalledWith({
        where: {
          userId_organizationId: {
            userId: mockUserId,
            organizationId: mockOrgId,
          },
        },
        data: {
          accepted: mockMembershipData.accepted,
          role: "owner",
        },
      });
    });

    test("throws DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.membership.findUnique).mockRejectedValue(prismaError);

      await expect(createMembership(mockOrgId, mockUserId, mockMembershipData)).rejects.toThrow(
        DatabaseError
      );
    });
  });
});
