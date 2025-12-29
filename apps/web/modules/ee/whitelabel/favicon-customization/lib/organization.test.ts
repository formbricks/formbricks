import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { removeOrganizationFaviconUrl, updateOrganizationFaviconUrl } from "./organization";

vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("favicon organization", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("updateOrganizationFaviconUrl", () => {
    test("should update organization favicon URL", async () => {
      const mockOrganization = {
        id: "clg123456789012345678901234",
        whitelabel: {
          logoUrl: "logo.png",
          faviconUrl: "old-favicon.png",
        },
      };

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as never);
      vi.mocked(prisma.organization.update).mockResolvedValue({} as never);

      const result = await updateOrganizationFaviconUrl("clg123456789012345678901234", "new-favicon.png");

      expect(result).toBe(true);
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
        select: { whitelabel: true },
      });
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
        data: {
          whitelabel: {
            ...mockOrganization.whitelabel,
            faviconUrl: "new-favicon.png",
          },
        },
      });
    });

    test("should throw ResourceNotFoundError when organization is not found", async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

      await expect(
        updateOrganizationFaviconUrl("clg123456789012345678901234", "new-favicon.png")
      ).rejects.toThrow(ResourceNotFoundError);

      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
        select: { whitelabel: true },
      });
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    test("should handle organization with no existing whitelabel", async () => {
      const mockOrganization = {
        id: "clg123456789012345678901234",
        whitelabel: null,
      };

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as never);
      vi.mocked(prisma.organization.update).mockResolvedValue({} as never);

      const result = await updateOrganizationFaviconUrl("clg123456789012345678901234", "new-favicon.png");

      expect(result).toBe(true);
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
        data: {
          whitelabel: {
            faviconUrl: "new-favicon.png",
          },
        },
      });
    });
  });

  describe("removeOrganizationFaviconUrl", () => {
    test("should remove organization favicon URL", async () => {
      const mockOrganization = {
        id: "clg123456789012345678901234",
        whitelabel: {
          logoUrl: "logo.png",
          faviconUrl: "old-favicon.png",
        },
      };

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as never);
      vi.mocked(prisma.organization.update).mockResolvedValue({} as never);

      const result = await removeOrganizationFaviconUrl("clg123456789012345678901234");

      expect(result).toBe(true);
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
        select: { whitelabel: true },
      });
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
        data: {
          whitelabel: {
            ...mockOrganization.whitelabel,
            faviconUrl: null,
          },
        },
      });
    });

    test("should throw ResourceNotFoundError when organization is not found", async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

      await expect(removeOrganizationFaviconUrl("clg123456789012345678901234")).rejects.toThrow(
        ResourceNotFoundError
      );

      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
        select: { whitelabel: true },
      });
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    test("should handle organization with no existing whitelabel", async () => {
      const mockOrganization = {
        id: "clg123456789012345678901234",
        whitelabel: null,
      };

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as never);
      vi.mocked(prisma.organization.update).mockResolvedValue({} as never);

      const result = await removeOrganizationFaviconUrl("clg123456789012345678901234");

      expect(result).toBe(true);
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
        data: {
          whitelabel: {
            faviconUrl: null,
          },
        },
      });
    });

    test("should throw ResourceNotFoundError when prisma update fails with record not found", async () => {
      const mockOrganization = {
        id: "clg123456789012345678901234",
        whitelabel: {
          faviconUrl: "old-favicon.png",
        },
      };

      const mockError = new Prisma.PrismaClientKnownRequestError("Record does not exist", {
        code: "P2015", // PrismaErrorType.RecordDoesNotExist
        clientVersion: "2.0.0",
      });

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as never);
      vi.mocked(prisma.organization.update).mockRejectedValue(mockError);

      await expect(removeOrganizationFaviconUrl("clg123456789012345678901234")).rejects.toThrow(
        ResourceNotFoundError
      );
    });
  });
});
