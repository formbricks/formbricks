import {
  environmentId,
  environmentIds,
  organizationBilling,
  organizationId,
} from "./__mocks__/organization.mock";
import {
  getMonthlyOrganizationResponseCount,
  getOrganizationBilling,
  getOrganizationIdFromEnvironmentId,
} from "@/modules/api/management/responses/lib/organization";
import { getAllEnvironmentsFromOrganizationId } from "@/modules/api/management/responses/lib/project";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { ok } from "@formbricks/types/error-handlers";

vi.mock("@/modules/api/management/responses/lib/project", () => ({
  getAllEnvironmentsFromOrganizationId: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: {
      findFirst: vi.fn(),
    },
    response: {
      aggregate: vi.fn(),
    },
  },
}));

describe("Organization Lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrganizationIdFromEnvironmentId", () => {
    test("return organization id when found", async () => {
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({ id: organizationId });

      const result = await getOrganizationIdFromEnvironmentId(environmentId);
      expect(prisma.organization.findFirst).toHaveBeenCalledWith({
        where: {
          projects: { some: { environments: { some: { id: environmentId } } } },
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
      const result = await getOrganizationIdFromEnvironmentId(environmentId);
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
      const result = await getOrganizationIdFromEnvironmentId(environmentId);
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
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({ billing: organizationBilling });

      const result = await getOrganizationBilling(organizationId);
      expect(prisma.organization.findFirst).toHaveBeenCalledWith({
        where: { id: organizationId },
        select: { billing: true },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.billing).toEqual(organizationBilling);
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

  describe("getMonthlyOrganizationResponseCount", () => {
    test("return error if getOrganizationBilling returns error", async () => {
      vi.mocked(prisma.organization.findFirst).mockResolvedValue(null);
      const result = await getMonthlyOrganizationResponseCount(organizationId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "organization", issue: "not found" }],
        });
      }
    });

    test("return error if billing plan is not free and periodStart is not set", async () => {
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({
        billing: { ...organizationBilling, periodStart: null },
      });

      const result = await getMonthlyOrganizationResponseCount(organizationId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "internal_server_error",
          details: [{ field: "organization", issue: "billing period start is not set" }],
        });
      }
    });

    test("return response count", async () => {
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({ billing: organizationBilling });
      vi.mocked(prisma.response.aggregate).mockResolvedValue({ _count: { id: 5 } });
      vi.mocked(getAllEnvironmentsFromOrganizationId).mockResolvedValue(ok(environmentIds));

      const result = await getMonthlyOrganizationResponseCount(organizationId);
      expect(prisma.response.aggregate).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(5);
      }
    });

    test("handle internal_server_error in aggregation", async () => {
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({ billing: organizationBilling });
      const error = new Error("Aggregate error");
      vi.mocked(prisma.response.aggregate).mockRejectedValue(error);
      vi.mocked(getAllEnvironmentsFromOrganizationId).mockResolvedValue(ok(environmentIds));

      const result = await getMonthlyOrganizationResponseCount(organizationId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "internal_server_error",
          details: [{ field: "organization", issue: "Aggregate error" }],
        });
      }
    });
  });
});
