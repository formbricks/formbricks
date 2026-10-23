import { organizationBilling, organizationId, workspaceId } from "./__mocks__/organization.mock";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  getOrganizationBilling,
  getOrganizationIdFromWorkspaceId,
} from "@/modules/api/v2/management/responses/lib/organization";

vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: {
      findFirst: vi.fn(),
    },
  },
}));

describe("Organization Lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrganizationIdFromWorkspaceId", () => {
    test("return organization id when found", async () => {
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({ id: organizationId } as any);

      const result = await getOrganizationIdFromWorkspaceId(workspaceId);
      expect(prisma.organization.findFirst).toHaveBeenCalledWith({
        where: {
          workspaces: { some: { id: workspaceId } },
        },
        select: { id: true },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(organizationId);
      }
    });

    test("return a not_found error when organization is not found", async () => {
      vi.mocked(prisma.organization.findFirst).mockResolvedValue(null);
      const result = await getOrganizationIdFromWorkspaceId(workspaceId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "organization", issue: "not found" }],
        });
      }
    });

    test("return an internal_server_error when an exception is thrown", async () => {
      const error = new Error("DB error");
      vi.mocked(prisma.organization.findFirst).mockRejectedValue(error);
      const result = await getOrganizationIdFromWorkspaceId(workspaceId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "internal_server_error",
          details: [{ field: "organization", issue: "DB error" }],
        });
      }
    });
  });

  describe("getOrganizationBilling", () => {
    test("return organization billing when found", async () => {
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({
        billing: organizationBilling,
      } as any);

      const result = await getOrganizationBilling(organizationId);
      expect(prisma.organization.findFirst).toHaveBeenCalledWith({
        where: { id: organizationId },
        select: {
          billing: {
            select: {
              stripeCustomerId: true,
              limits: true,
              usageCycleAnchor: true,
              stripe: true,
            },
          },
        },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(organizationBilling);
      }
    });

    test("return a not_found error when organization is not found", async () => {
      vi.mocked(prisma.organization.findFirst).mockResolvedValue(null);
      const result = await getOrganizationBilling(organizationId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "organization", issue: "not found" }],
        });
      }
    });

    test("handle PrismaClientKnownRequestError", async () => {
      const error = new Error("DB error");
      vi.mocked(prisma.organization.findFirst).mockRejectedValue(error);

      const result = await getOrganizationBilling(organizationId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "internal_server_error",
          details: [{ field: "organization", issue: "DB error" }],
        });
      }
    });
  });
});
