import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import {
  getOrganizationEmailLogo,
  removeOrganizationEmailLogoUrl,
  updateOrganizationEmailLogoUrl,
} from "./organization";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

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
        workspaces: [
          {
            id: "clp123456789012345678901234",
          },
        ],
      };

      vi.mocked(prisma.organization.findUnique, { partial: true }).mockResolvedValue(mockOrganization);
      vi.mocked(prisma.organization.update).mockResolvedValue(
        mockUpdatedOrganization as unknown as Awaited<ReturnType<typeof prisma.organization.update>>
      );

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
          workspaces: {
            select: {
              id: true,
            },
          },
        },
      });
    });

    test("clears a removed logo when a new one is uploaded, keeping the other whitelabel settings", async () => {
      vi.mocked(prisma.organization.findUnique, { partial: true }).mockResolvedValue({
        id: "clg123456789012345678901234",
        whitelabel: { logoUrl: null, hideLogo: true, faviconUrl: "/storage/favicon.png" },
      });
      vi.mocked(prisma.organization.update, { partial: true }).mockResolvedValue({});

      await updateOrganizationEmailLogoUrl("clg123456789012345678901234", "new-logo.png");

      expect(vi.mocked(prisma.organization.update).mock.calls[0][0].data).toEqual({
        whitelabel: { logoUrl: "new-logo.png", faviconUrl: "/storage/favicon.png" },
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

    test("should throw ResourceNotFoundError when the update targets a missing organization (P2025)", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Record to update not found", {
        code: "P2025",
        clientVersion: "5.0.0",
      });

      vi.mocked(prisma.organization.findUnique, { partial: true }).mockResolvedValue({ whitelabel: {} });
      vi.mocked(prisma.organization.update).mockRejectedValue(prismaError);

      await expect(
        updateOrganizationEmailLogoUrl("clg123456789012345678901234", "new-logo.png")
      ).rejects.toThrow(ResourceNotFoundError);
    });
  });

  describe("removeOrganizationEmailLogoUrl", () => {
    test("should remove organization email logo URL", async () => {
      const mockOrganization = {
        id: "clg123456789012345678901234",
        whitelabel: {
          logoUrl: "old-logo.png",
        },
        workspaces: [
          {
            id: "clp123456789012345678901234",
          },
        ],
      };

      vi.mocked(prisma.organization.findUnique, { partial: true }).mockResolvedValue(mockOrganization);
      vi.mocked(prisma.organization.update, { partial: true }).mockResolvedValue({});

      const result = await removeOrganizationEmailLogoUrl("clg123456789012345678901234");

      expect(result).toBe(true);
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
        select: {
          whitelabel: true,
          workspaces: {
            select: {
              id: true,
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
            hideLogo: true,
          },
        },
      });
    });

    test("records the removal even when the Formbricks logo was showing, keeping the favicon", async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        whitelabel: { logoUrl: null, faviconUrl: "/storage/favicon.png" },
        workspaces: [],
      } as unknown as Awaited<ReturnType<typeof prisma.organization.findUnique>>);
      vi.mocked(prisma.organization.update, { partial: true }).mockResolvedValue({});

      await removeOrganizationEmailLogoUrl("clg123456789012345678901234");

      expect(vi.mocked(prisma.organization.update).mock.calls[0][0].data).toEqual({
        whitelabel: { logoUrl: null, faviconUrl: "/storage/favicon.png", hideLogo: true },
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
          workspaces: {
            select: {
              id: true,
            },
          },
        },
      });
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    test("should throw ResourceNotFoundError when the update targets a missing organization (P2025)", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Record to update not found", {
        code: "P2025",
        clientVersion: "5.0.0",
      });

      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        whitelabel: {},
        workspaces: [],
      } as unknown as Awaited<ReturnType<typeof prisma.organization.findUnique>>);
      vi.mocked(prisma.organization.update).mockRejectedValue(prismaError);

      await expect(removeOrganizationEmailLogoUrl("clg123456789012345678901234")).rejects.toThrow(
        ResourceNotFoundError
      );
    });
  });

  describe("getOrganizationEmailLogo", () => {
    test("should return logo URL when organization exists", async () => {
      const mockOrganization = {
        whitelabel: {
          logoUrl: "logo.png",
        },
      };

      vi.mocked(prisma.organization.findUnique, { partial: true }).mockResolvedValue(mockOrganization);

      const result = await getOrganizationEmailLogo("clg123456789012345678901234");

      expect(result).toEqual({ logoUrl: "logo.png", hideLogo: false });
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
        select: {
          whitelabel: true,
        },
      });
    });

    test("reports a removed logo", async () => {
      vi.mocked(prisma.organization.findUnique, { partial: true }).mockResolvedValue({
        whitelabel: { logoUrl: null, hideLogo: true },
      });

      const result = await getOrganizationEmailLogo("clg123456789012345678901234");

      expect(result).toEqual({ logoUrl: null, hideLogo: true });
    });

    test("should return no logo when organization exists but has no logo URL", async () => {
      const mockOrganization = {
        whitelabel: {},
      };

      vi.mocked(prisma.organization.findUnique, { partial: true }).mockResolvedValue(mockOrganization);

      const result = await getOrganizationEmailLogo("clg123456789012345678901234");

      expect(result).toEqual({ logoUrl: null, hideLogo: false });
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
        select: {
          whitelabel: true,
        },
      });
    });

    test("should return null when organization does not exist", async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

      const result = await getOrganizationEmailLogo("clg123456789012345678901234");

      expect(result).toEqual({ logoUrl: null, hideLogo: false });
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

      await expect(getOrganizationEmailLogo("clg123456789012345678901234")).rejects.toThrow(DatabaseError);
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "clg123456789012345678901234" },
        select: {
          whitelabel: true,
        },
      });
    });
  });

  describe("updateOrganizationEmailLogoUrl input validation", () => {
    const organizationId = "clg123456789012345678901234";

    beforeEach(async () => {
      const actual = await vi.importActual<typeof import("@/lib/utils/validate")>("@/lib/utils/validate");
      vi.mocked(validateInputs).mockImplementation(actual.validateInputs);
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: organizationId,
        whitelabel: {},
      } as Awaited<ReturnType<typeof prisma.organization.findUnique>>);
      vi.mocked(prisma.organization.update).mockResolvedValue({ workspaces: [] } as unknown as Awaited<
        ReturnType<typeof prisma.organization.update>
      >);
    });

    afterEach(() => {
      vi.mocked(validateInputs).mockReset();
    });

    test.each([
      "javascript:alert(document.domain)",
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      "vbscript:msgbox(1)",
      "not a url",
    ])("rejects %s without writing it", async (logoUrl) => {
      // importActual loads its own copy of the errors module, so match the error by name, not class.
      await expect(updateOrganizationEmailLogoUrl(organizationId, logoUrl)).rejects.toMatchObject({
        name: "ValidationError",
        message: expect.stringContaining("Must be a valid http(s) URL or a relative storage path"),
      });
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    test.each(["/storage/clp123456789012345678901234/public/logo.png", "https://cdn.example.com/logo.png"])(
      "saves %s",
      async (logoUrl) => {
        await expect(updateOrganizationEmailLogoUrl(organizationId, logoUrl)).resolves.toBe(true);
        expect(prisma.organization.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: { whitelabel: { logoUrl } } })
        );
      }
    );
  });
});
