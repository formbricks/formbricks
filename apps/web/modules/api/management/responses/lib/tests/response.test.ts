import {
  environmentId,
  organizationBilling,
  organizationId,
  response,
  responseFilter,
  responseInput,
} from "./__mocks__/response.mock";
import {
  getMonthlyOrganizationResponseCount,
  getOrganizationBilling,
  getOrganizationIdFromEnvironmentId,
} from "@/modules/api/management/responses/lib/organization";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
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

vi.mock("@formbricks/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: true,
  IS_PRODUCTION: false,
}));

describe("Response Lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createResponse", () => {
    test("create a response successfully", async () => {
      vi.mocked(prisma.response.create).mockResolvedValue(response);

      vi.mocked(getOrganizationIdFromEnvironmentId).mockResolvedValue(ok(organizationId));
      vi.mocked(getOrganizationBilling).mockResolvedValue(ok({ billing: organizationBilling }));
      vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(ok(50));

      const result = await createResponse(environmentId, responseInput);
      expect(prisma.response.create).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(response);
      }
    });

    test("return error if getOrganizationIdFromEnvironmentId fails", async () => {
      vi.mocked(getOrganizationIdFromEnvironmentId).mockResolvedValue(
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

    test("return error if getOrganizationBilling fails", async () => {
      vi.mocked(getOrganizationIdFromEnvironmentId).mockResolvedValue(ok(organizationId));
      vi.mocked(getOrganizationBilling).mockResolvedValue(
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

    test("send plan limit event when in cloud and responses limit is reached", async () => {
      vi.mocked(prisma.response.create).mockResolvedValue(response);

      vi.mocked(getOrganizationIdFromEnvironmentId).mockResolvedValue(ok(organizationId));

      vi.mocked(getOrganizationBilling).mockResolvedValue(ok({ billing: organizationBilling }));

      vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(ok(100));

      vi.mocked(sendPlanLimitsReachedEventToPosthogWeekly).mockImplementation(() => Promise.resolve(""));

      const result = await createResponse(environmentId, responseInput);

      expect(sendPlanLimitsReachedEventToPosthogWeekly).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(response);
      }
    });
  });

  describe("getResponses", () => {
    test("return responses with meta information", async () => {
      const responses = [response];
      prisma.$transaction = vi.fn().mockResolvedValue([responses, responses.length]);

      const result = await getResponses(environmentId, responseFilter);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          data: [response],
          meta: {
            total: responses.length,
            limit: responseFilter.limit,
            offset: responseFilter.skip,
          },
        });
      }
    });

    test("return a not_found error if responses are not found", async () => {
      prisma.$transaction = vi.fn().mockResolvedValue([null, 0]);

      const result = await getResponses(environmentId, responseFilter);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "not_found",
          details: [{ field: "responses", issue: "not found" }],
        });
      }
    });

    test("return an internal_server_error error if prisma transaction fails", async () => {
      prisma.$transaction = vi.fn().mockRejectedValue(new Error("Internal server error"));

      const result = await getResponses(environmentId, responseFilter);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "internal_server_error",
          details: [{ field: "responses", issue: "Internal server error" }],
        });
      }
    });
  });
});
