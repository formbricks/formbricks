import {
  getMonthlyOrganizationResponseCount,
  getOrganizationBilling,
  getOrganizationIdFromEnvironmentId,
} from "@/modules/api/management/responses/lib/organization";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { sendPlanLimitsReachedEventToPosthogWeekly } from "@formbricks/lib/posthogServer";
import { err, ok } from "@formbricks/types/error-handlers";
import { createResponse, getResponses } from "../response";

vi.mock("@formbricks/lib/posthogServer", () => ({
  sendPlanLimitsReachedEventToPosthogWeekly: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/api/management/responses/lib/organization", () => ({
  getOrganizationIdFromEnvironmentId: vi.fn(),
  getOrganizationBilling: vi.fn(),
  getMonthlyOrganizationResponseCount: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe("Response Lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createResponse", () => {
    const environmentId = "env_1";
    const responseInput = {
      surveyId: "survey_1",
      displayId: "display_1",
      finished: true,
      data: { key: "value" },
      language: "en",
      meta: { info: "meta" },
      singleUseId: "sui_1",
      variables: {},
      ttc: { sample: 1 },
      createdAt: new Date(),
      updatedAt: new Date(),
      endingId: "ending_1",
    };

    it("should create a response successfully", async () => {
      const createdResponse = { id: "resp_1", ...responseInput };
      vi.mocked(prisma.response.create).mockResolvedValue(createdResponse);

      vi.mocked(getOrganizationIdFromEnvironmentId).mockResolvedValue(ok("org_1"));
      vi.mocked(getOrganizationBilling).mockResolvedValue(
        ok({ billing: { plan: "free", limits: { monthly: { responses: 100 } } } })
      );
      vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(ok(50));

      vi.stubGlobal("IS_FORMBRICKS_CLOUD", false);

      const result = await createResponse(environmentId, responseInput);
      expect(prisma.response.create).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(createdResponse);
      }
    });

    it("should return error if getOrganizationIdFromEnvironmentId fails", async () => {
      (getOrganizationIdFromEnvironmentId as any).mockResolvedValue(
        err({ type: "not_found", details: [{ field: "organization", issue: "not found" }] })
      );
      const result = await createResponse(environmentId, responseInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "organization", issue: "not found" }],
        });
      }
    });

    it("should return error if getOrganizationBilling fails", async () => {
      (getOrganizationIdFromEnvironmentId as any).mockResolvedValue(ok("org_1"));
      (getOrganizationBilling as any).mockResolvedValue(
        err({ type: "not_found", details: [{ field: "organization", issue: "not found" }] })
      );
      const result = await createResponse(environmentId, responseInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "organization", issue: "not found" }],
        });
      }
    });

    // it('should send plan limit event when in cloud and responses limit is reached', async () => {
    //   // Set IS_FORMBRICKS_CLOUD to true for this test
    //   vi.stubGlobal('IS_FORMBRICKS_CLOUD', true);
    //   const createdResponse = { id: 'resp_2', ...responseInput };
    //   vi.mocked(prisma.response.create).mockResolvedValue(createdResponse);

    //   vi.mocked(getOrganizationIdFromEnvironmentId).mockResolvedValue(ok('org_2'));
    //   vi.mocked(getOrganizationBilling).mockResolvedValue(ok({ billing: { plan: 'free', limits: { monthly: { responses: 10 } } } }));

    //   vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(ok(10));

    //   const result = await createResponse(environmentId, responseInput);
    //   vi.mocked(sendPlanLimitsReachedEventToPosthogWeekly).mockImplementation(() => Promise.resolve());
    //   expect(sendPlanLimitsReachedEventToPosthogWeekly).toHaveBeenCalled();
    //   expect(result.ok).toBe(true);
    //   if (result.ok) {
    //     expect(result.data).toEqual(createdResponse);
    //   }
    // });
  });

  describe("getResponses", () => {
    it("should return responses with meta information", async () => {
      const environmentId = "env_1";
      const params = { limit: 10, skip: 5 };
      const responses = [{ id: "resp_1" }, { id: "resp_2" }];
      const count = 2;
      prisma.$transaction = vi.fn().mockResolvedValue([responses, count]);

      const result = await getResponses(environmentId, params);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          data: responses,
          meta: {
            total: count,
            limit: params.limit,
            offset: params.skip,
          },
        });
      }
    });

    it("should return a not_found error if responses are not found", async () => {
      const environmentId = "env_1";
      const params = { limit: 10, skip: 5 };
      prisma.$transaction = vi.fn().mockResolvedValue([null, 0]);

      const result = await getResponses(environmentId, params);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "responses", issue: "not found" }],
        });
      }
    });
  });
});
