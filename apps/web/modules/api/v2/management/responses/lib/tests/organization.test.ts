import {
  environmentId,
  environmentIds,
  organizationBilling,
  organizationEnvironments,
  organizationId,
} from "./__mocks__/organization.mock";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  getAllEnvironmentsFromOrganizationId,
  getMonthlyOrganizationResponseCount,
  getOrganizationBilling,
  getOrganizationIdFromEnvironmentId,
} from "@/modules/api/v2/management/responses/lib/organization";

type OrgFindFirst = Awaited<ReturnType<typeof prisma.organization.findFirst>>;
type OrgFindUnique = Awaited<ReturnType<typeof prisma.organization.findUnique>>;
type ResponseAggregate = Awaited<ReturnType<typeof prisma.response.aggregate>>;

vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
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
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({ id: organizationId } as OrgFindFirst);

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
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({
        billing: organizationBilling,
      } as OrgFindFirst);

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

  describe("getAllEnvironmentsFromOrganizationId", () => {
    test("return all environments from organization", async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(
        organizationEnvironments as unknown as OrgFindUnique
      );
      const result = await getAllEnvironmentsFromOrganizationId(organizationId);
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: organizationId },
        select: {
          projects: {
            select: {
              environments: { select: { id: true } },
            },
          },
        },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(environmentIds);
      }
    });

    test("return a not_found error when organization is not found", async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);
      const result = await getAllEnvironmentsFromOrganizationId(organizationId);
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
      vi.mocked(prisma.organization.findUnique).mockRejectedValue(error);
      const result = await getAllEnvironmentsFromOrganizationId(organizationId);
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

    test("return response count when usageCycleAnchor is not set", async () => {
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({
        billing: { ...organizationBilling, usageCycleAnchor: null },
      } as OrgFindFirst);
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(
        organizationEnvironments as unknown as OrgFindUnique
      );
      vi.mocked(prisma.response.aggregate).mockResolvedValue({
        _count: { id: 5 },
      } as unknown as ResponseAggregate);

      const result = await getMonthlyOrganizationResponseCount(organizationId);
      expect(result.ok).toBe(true);
      expect(prisma.response.aggregate).toHaveBeenCalledTimes(1);
      if (result.ok) {
        expect(result.data).toBe(5);
      }
    });

    test("return response count", async () => {
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({
        billing: organizationBilling,
      } as OrgFindFirst);
      vi.mocked(prisma.response.aggregate).mockResolvedValue({
        _count: { id: 5 },
      } as unknown as ResponseAggregate);
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(
        organizationEnvironments as unknown as OrgFindUnique
      );

      const result = await getMonthlyOrganizationResponseCount(organizationId);
      expect(prisma.response.aggregate).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(5);
      }
    });

    test("handle internal_server_error in aggregation", async () => {
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({
        billing: organizationBilling,
      } as OrgFindFirst);
      const error = new Error("Aggregate error");
      vi.mocked(prisma.response.aggregate).mockRejectedValue(error);
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(
        organizationEnvironments as unknown as OrgFindUnique
      );

      const result = await getMonthlyOrganizationResponseCount(organizationId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "internal_server_error",
          details: [{ field: "organization", issue: "Aggregate error" }],
        });
      }
    });

    test("handle error when getAllEnvironmentsFromOrganizationId fails", async () => {
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({
        billing: organizationBilling,
      } as OrgFindFirst);
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

      const result = await getMonthlyOrganizationResponseCount(organizationId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "organization", issue: "not found" }],
        });
      }
    });
  });
});
