import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  getOrganizationLogoUrl,
  removeOrganizationEmailLogoUrl,
  updateOrganizationEmailLogoUrl,
} from "./organization";

vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("react", () => ({
  cache: vi.fn((fn) => fn),
}));

describe("organization", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("updateOrganizationEmailLogoUrl", () => {
    test("should update organization email logo URL", async () => {
      const mockOrganization = {
        id: "clg123456789012345678901234",
        whitelabel: {
          logoUrl: "old-logo.png",
        },
      };

      const mockUpdatedOrganization = {
        projects: [
          {
            id: "clp123456789012345678901234",
            environments: [{ id: "cle123456789012345678901234" }],
          },
        ],
      };

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);
      vi.mocked(prisma.organization.update).mockResolvedValue(mockUpdatedOrganization as any);

      const result = await updateOrganizationEmailLogoUrl("clg123456789012345678901234", "new-logo.png");

      expect(result).toBe(true);
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
      });
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
        data: {
          whitelabel: {
            ...mockOrganization.whitelabel,
            logoUrl: "new-logo.png",
          },
        },
        select: {
          projects: {
            select: {
              id: true,
              environments: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });
    });

    test("should throw ResourceNotFoundError when organization is not found", async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

      await expect(
        updateOrganizationEmailLogoUrl("clg123456789012345678901234", "new-logo.png")
      ).rejects.toThrow(ResourceNotFoundError);

      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
      });
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });
  });

  describe("removeOrganizationEmailLogoUrl", () => {
    test("should remove organization email logo URL", async () => {
      const mockOrganization = {
        id: "clg123456789012345678901234",
        whitelabel: {
          logoUrl: "old-logo.png",
        },
        projects: [
          {
            id: "clp123456789012345678901234",
            environments: [{ id: "cle123456789012345678901234" }],
          },
        ],
      };

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);
      vi.mocked(prisma.organization.update).mockResolvedValue({} as any);

      const result = await removeOrganizationEmailLogoUrl("clg123456789012345678901234");

      expect(result).toBe(true);
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
        select: {
          whitelabel: true,
          projects: {
            select: {
              id: true,
              environments: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
        data: {
          whitelabel: {
            ...mockOrganization.whitelabel,
            logoUrl: null,
          },
        },
      });
    });

    test("should throw ResourceNotFoundError when organization is not found", async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

      await expect(removeOrganizationEmailLogoUrl("clg123456789012345678901234")).rejects.toThrow(
        ResourceNotFoundError
      );

      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
        select: {
          whitelabel: true,
          projects: {
            select: {
              id: true,
              environments: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });
  });

  describe("getOrganizationLogoUrl", () => {
    test("should return logo URL when organization exists", async () => {
      const mockOrganization = {
        whitelabel: {
          logoUrl: "logo.png",
        },
      };

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);

      const result = await getOrganizationLogoUrl("clg123456789012345678901234");

      expect(result).toBe("logo.png");
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
        select: {
          whitelabel: true,
        },
      });
    });

    test("should return null when organization exists but has no logo URL", async () => {
      const mockOrganization = {
        whitelabel: {},
      };

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);

      const result = await getOrganizationLogoUrl("clg123456789012345678901234");

      expect(result).toBeNull();
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
        select: {
          whitelabel: true,
        },
      });
    });

    test("should return null when organization does not exist", async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

      const result = await getOrganizationLogoUrl("clg123456789012345678901234");

      expect(result).toBeNull();
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
        select: {
          whitelabel: true,
        },
      });
    });

    test("should throw DatabaseError when prisma throws a known error", async () => {
      const mockError = new Prisma.PrismaClientKnownRequestError("Test error", {
        code: "P2002",
        clientVersion: "2.0.0",
      });

      vi.mocked(prisma.organization.findUnique).mockRejectedValue(mockError);

      await expect(getOrganizationLogoUrl("clg123456789012345678901234")).rejects.toThrow(DatabaseError);
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
        select: {
          whitelabel: true,
        },
      });
    });
  });
});
