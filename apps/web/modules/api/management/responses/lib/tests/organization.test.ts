import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { err, ok } from "@formbricks/types/error-handlers";
import {
  getMonthlyOrganizationResponseCount,
  getOrganizationBilling,
  getOrganizationIdFromEnvironmentId,
} from "../organization";
import { getAllEnvironmentsFromOrganizationId } from "../project";

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
    it("should return organization id when found", async () => {
      const environmentId = "env_1";
      vi.mocked(prisma.organization.findFirst).mockResolvedValue({ id: "org_1" });

      const result = await getOrganizationIdFromEnvironmentId(environmentId);
      expect(prisma.organization.findFirst).toHaveBeenCalledWith({
        where: {
          projects: { some: { environments: { some: { id: environmentId } } } },
        },
        select: { id: true },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe("org_1");
      }
    });

    it("should return a not_found error when organization is not found", async () => {
      const environmentId = "env_not_found";
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

    it("should return an internal_server_error when an exception is thrown", async () => {
      const environmentId = "env_err";
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
    it("should return organization billing when found", async () => {
      const organizationId = "org_1";
      const billing = { plan: "free", limits: { monthly: { responses: 100 } } };
      prisma.organization.findFirst = vi.fn().mockResolvedValue({ billing });

      const result = await getOrganizationBilling(organizationId);
      expect(prisma.organization.findFirst).toHaveBeenCalledWith({
        where: { id: organizationId },
        select: { billing: true },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.billing).toEqual(billing);
      }
    });

    it("should return a not_found error when organization is not found", async () => {
      const organizationId = "org_not_found";
      prisma.organization.findFirst = vi.fn().mockResolvedValue(null);
      const result = await getOrganizationBilling(organizationId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "organization", issue: "not found" }],
        });
      }
    });

    it("should handle PrismaClientKnownRequestError", async () => {
      const organizationId = "org_err";
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

  // describe('getMonthlyOrganizationResponseCount', () => {
  //   it('should return error if getOrganizationBilling returns error', async () => {
  //     const organizationId = 'org_err';
  //     // vi.mocked(getOrganizationBilling).mockResolvedValue(
  //     //   err({ type: 'not_found', details: [{ field: 'organization', issue: 'not found' }] })
  //     // );
  //     vi.spyOn(require('../organization'), 'getOrganizationBilling').mockResolvedValue(
  //       err({ type: 'not_found', details: [{ field: 'organization', issue: 'not found' }] })
  //     );
  //     const result = await getMonthlyOrganizationResponseCount(organizationId);
  //     expect(result.ok).toBe(false);
  //     if (!result.ok) {
  //       expect(result.error).toEqual({
  //         type: 'not_found',
  //         details: [{ field: 'organization', issue: 'not found' }],
  //       });
  //     }
  //   });

  //   it('should return error if billing plan is not free and periodStart is not set', async () => {
  //     const organizationId = 'org_2';
  //     const billing = { plan: 'premium', periodStart: null, limits: { monthly: { responses: 200 } } };
  //     vi.mocked(getOrganizationBilling).mockResolvedValue(ok({ billing }));
  //     const result = await getMonthlyOrganizationResponseCount(organizationId);
  //     expect(result.ok).toBe(false);
  //     if (!result.ok) {
  //       expect(result.error).toEqual({
  //         type: 'internal_server_error',
  //         details: [{ field: 'organization', issue: 'billing period start is not set' }],
  //       });
  //     }
  //   });

  //   it('should return response count for free plan', async () => {
  //     const organizationId = 'org_3';
  //     const billing = { plan: 'free', limits: { monthly: { responses: 100 } } };
  //     vi.mocked(getOrganizationBilling).mockResolvedValue(ok({ billing }));
  //     vi.mocked(prisma.response.aggregate).mockResolvedValue({ _count: { id: 5 } });
  //     vi.mocked(getAllEnvironmentsFromOrganizationId).mockResolvedValue(ok(['env1', 'env2']));

  //     const result = await getMonthlyOrganizationResponseCount(organizationId);
  //     expect(prisma.response.aggregate).toHaveBeenCalled();
  //     expect(result.ok).toBe(true);
  //     if (result.ok) {
  //       expect(result.data).toBe(5);
  //     }
  //   });

  //   it('should return response count for non-free plan', async () => {
  //     const organizationId = 'org_4';
  //     const periodStart = new Date('2023-01-01');
  //     const billing = { plan: 'premium', periodStart, limits: { monthly: { responses: 150 } } };
  //     vi.mocked(getOrganizationBilling).mockResolvedValue(ok({ billing }));
  //     const fakeAggregateResult = { _count: { id: 10 } };
  //     vi.mocked(prisma.response.aggregate).mockResolvedValue(fakeAggregateResult);
  //     vi.mocked(getAllEnvironmentsFromOrganizationId).mockResolvedValue(ok(['env3']));

  //     const result = await getMonthlyOrganizationResponseCount(organizationId);
  //     expect(prisma.response.aggregate).toHaveBeenCalledWith({
  //       _count: { id: true },
  //       where: {
  //         AND: [
  //           { survey: { environmentId: { in: ['env3'] } } },
  //           { createdAt: { gte: periodStart } },
  //         ],
  //       },
  //     });
  //     expect(result.ok).toBe(true);
  //     if (result.ok) {
  //       expect(result.data).toBe(10);
  //     }
  //   });

  //   it('should handle internal_server_error in aggregation', async () => {
  //     const organizationId = 'org_5';
  //     const periodStart = new Date('2023-01-01');
  //     const billing = { plan: 'premium', periodStart, limits: { monthly: { responses: 150 } } };
  //     vi.mocked(getOrganizationBilling).mockResolvedValue(ok({ billing }));
  //     const error = new Error('Aggregate error');
  //     vi.mocked(prisma.response.aggregate).mockRejectedValue(error);
  //     vi.mocked(getAllEnvironmentsFromOrganizationId).mockResolvedValue(ok(['envX']));

  //     const result = await getMonthlyOrganizationResponseCount(organizationId);
  //     expect(result.ok).toBe(false);
  //     if (!result.ok) {
  //       expect(result.error).toEqual({
  //         type: 'internal_server_error',
  //         details: [{ field: 'organization', issue: 'Aggregate error' }],
  //       });
  //     }
  //   });
  // });
});
