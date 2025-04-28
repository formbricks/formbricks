import {
  environmentId,
  organizationBilling,
  organizationId,
  response,
  responseFilter,
  responseInput,
  responseInputNotFinished,
  responseInputWithoutDisplay,
  responseInputWithoutTtc,
} from "./__mocks__/response.mock";
import { sendPlanLimitsReachedEventToPosthogWeekly } from "@/lib/posthogServer";
import {
  getMonthlyOrganizationResponseCount,
  getOrganizationBilling,
  getOrganizationIdFromEnvironmentId,
} from "@/modules/api/v2/management/responses/lib/organization";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { err, ok } from "@formbricks/types/error-handlers";
import { createResponse, getResponses } from "../response";

vi.mock("@/lib/posthogServer", () => ({
  sendPlanLimitsReachedEventToPosthogWeekly: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/api/v2/management/responses/lib/organization", () => ({
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

vi.mock("@/lib/constants", () => ({
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
      vi.mocked(getOrganizationBilling).mockResolvedValue(ok(organizationBilling));
      vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(ok(50));

      const result = await createResponse(environmentId, responseInput);
      expect(prisma.response.create).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(response);
      }
    });

    test("handle response for initialTtc not finished", async () => {
      vi.mocked(prisma.response.create).mockResolvedValue(response);

      vi.mocked(getOrganizationIdFromEnvironmentId).mockResolvedValue(ok(organizationId));
      vi.mocked(getOrganizationBilling).mockResolvedValue(ok(organizationBilling));
      vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(ok(50));

      const result = await createResponse(environmentId, responseInputNotFinished);
      expect(prisma.response.create).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(response);
      }
    });

    test("handle response for initialTtc not provided", async () => {
      vi.mocked(prisma.response.create).mockResolvedValue(response);

      vi.mocked(getOrganizationIdFromEnvironmentId).mockResolvedValue(ok(organizationId));
      vi.mocked(getOrganizationBilling).mockResolvedValue(ok(organizationBilling));
      vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(ok(50));

      const result = await createResponse(environmentId, responseInputWithoutTtc);
      expect(prisma.response.create).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(response);
      }
    });

    test("handle response for display not provided", async () => {
      vi.mocked(prisma.response.create).mockResolvedValue(response);

      vi.mocked(getOrganizationIdFromEnvironmentId).mockResolvedValue(ok(organizationId));
      vi.mocked(getOrganizationBilling).mockResolvedValue(ok(organizationBilling));
      vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(ok(50));

      const result = await createResponse(environmentId, responseInputWithoutDisplay);
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

      vi.mocked(getOrganizationBilling).mockResolvedValue(ok(organizationBilling));

      vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(ok(100));

      vi.mocked(sendPlanLimitsReachedEventToPosthogWeekly).mockImplementation(() => Promise.resolve(""));

      const result = await createResponse(environmentId, responseInput);

      expect(sendPlanLimitsReachedEventToPosthogWeekly).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(response);
      }
    });

    test("handle error getting monthly organization response count", async () => {
      vi.mocked(prisma.response.create).mockResolvedValue(response);

      vi.mocked(getOrganizationIdFromEnvironmentId).mockResolvedValue(ok(organizationId));

      vi.mocked(getOrganizationBilling).mockResolvedValue(ok(organizationBilling));

      vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(
        err({ type: "internal_server_error", details: [{ field: "organization", issue: "Aggregate error" }] })
      );

      const result = await createResponse(environmentId, responseInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "internal_server_error",
          details: [{ field: "organization", issue: "Aggregate error" }],
        });
      }
    });

    test("handle error sending plan limits reached event", async () => {
      vi.mocked(prisma.response.create).mockResolvedValue(response);

      vi.mocked(getOrganizationIdFromEnvironmentId).mockResolvedValue(ok(organizationId));

      vi.mocked(getOrganizationBilling).mockResolvedValue(ok(organizationBilling));

      vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(ok(100));

      vi.mocked(sendPlanLimitsReachedEventToPosthogWeekly).mockRejectedValue(
        new Error("Error sending plan limits")
      );

      const result = await createResponse(environmentId, responseInput);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(response);
      }
    });

    test("return an internal_server_error error if prisma create fails", async () => {
      vi.mocked(prisma.response.create).mockRejectedValue(new Error("Internal server error"));

      const result = await createResponse(environmentId, responseInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toEqual("internal_server_error");
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
