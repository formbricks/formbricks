import { Prisma } from "@prisma/client";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganizationsByUserId } from "./organization";

vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: {
      findMany: vi.fn(),
    },
  },
}));

describe("Organization", () => {
  describe("getOrganizationsByUserId", () => {
    test("should return organizations when found", async () => {
      const mockOrganizations = [
        { id: "org1", name: "Organization 1" },
        { id: "org2", name: "Organization 2" },
      ];

      vi.mocked(prisma.organization.findMany).mockResolvedValue(mockOrganizations as any);

      const result = await getOrganizationsByUserId("user1");

      expect(prisma.organization.findMany).toHaveBeenCalledWith({
        where: {
          memberships: {
            some: {
              userId: "user1",
            },
          },
        },
        select: {
          id: true,
          name: true,
        },
      });
      expect(result).toEqual(mockOrganizations);
    });

    test("should throw ResourceNotFoundError when organizations is null", async () => {
      vi.mocked(prisma.organization.findMany).mockResolvedValue(null as any);

      await expect(getOrganizationsByUserId("user1")).rejects.toThrow(
        new ResourceNotFoundError("Organizations by UserId", "user1")
      );
    });

    test("should throw DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });

      vi.mocked(prisma.organization.findMany).mockRejectedValue(prismaError);

      await expect(getOrganizationsByUserId("user1")).rejects.toThrow(new DatabaseError("Database error"));
    });

    test("should re-throw unknown errors", async () => {
      const unknownError = new Error("Unknown error");
      vi.mocked(prisma.organization.findMany).mockRejectedValue(unknownError);

      await expect(getOrganizationsByUserId("user1")).rejects.toThrow(unknownError);
    });

    test("should validate inputs correctly", async () => {
      await expect(getOrganizationsByUserId("")).rejects.toThrow();
    });

    test("should validate userId input with invalid type", async () => {
      await expect(getOrganizationsByUserId(123 as any)).rejects.toThrow();
    });
  });
});
