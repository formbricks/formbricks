import {
  getMonthlyOrganizationResponseCount,
  getOrganizationByEnvironmentId,
} from "@/lib/organization/service";
import { sendPlanLimitsReachedEventToPosthogWeekly } from "@/lib/posthogServer";
import { getResponseContact } from "@/lib/response/service";
import { calculateTtcTotal } from "@/lib/response/utils";
import { validateInputs } from "@/lib/utils/validate";
import { Organization, Prisma, Response as ResponsePrisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponse, TResponseInput } from "@formbricks/types/responses";
import { getContactByUserId } from "./contact";
import { createResponse, getResponsesByEnvironmentIds } from "./response";

// Mock Data
const environmentId = "test-environment-id";
const organizationId = "test-organization-id";
const mockUserId = "test-user-id";
const surveyId = "test-survey-id";
const displayId = "test-display-id";
const responseId = "test-response-id";

const mockOrganization = {
  id: organizationId,
  name: "Test Org",
  createdAt: new Date(),
  updatedAt: new Date(),
  billing: { plan: "free", limits: { monthly: { responses: null } } } as any, // Default no limit
} as unknown as Organization;

const mockResponseInput: TResponseInput = {
  environmentId,
  surveyId,
  displayId,
  finished: true,
  data: { q1: "answer1" },
  meta: { userAgent: { browser: "test-browser" } },
  ttc: { q1: 5 },
  language: "en",
};

const mockResponseInputWithUserId: TResponseInput = {
  ...mockResponseInput,
  userId: mockUserId,
};

// Prisma response structure (simplified)
const mockResponsePrisma = {
  id: responseId,
  createdAt: new Date(),
  updatedAt: new Date(),
  surveyId,
  finished: true,
  endingId: null,
  data: { q1: "answer1" },
  meta: { userAgent: { browser: "test-browser" } },
  ttc: { q1: 5, total: 10 }, // Assume calculateTtcTotal adds 'total'
  variables: {},
  contactAttributes: {},
  singleUseId: null,
  language: "en",
  displayId,
  contact: null, // Prisma relation
  tags: [], // Prisma relation
  notes: [], // Prisma relation
} as unknown as ResponsePrisma & { contact: any; tags: any[]; notes: any[] }; // Adjust type as needed

const mockResponse: TResponse = {
  id: responseId,
  createdAt: mockResponsePrisma.createdAt,
  updatedAt: mockResponsePrisma.updatedAt,
  surveyId,
  finished: true,
  endingId: null,
  data: { q1: "answer1" },
  meta: { userAgent: { browser: "test-browser" } },
  ttc: { q1: 5, total: 10 },
  variables: {},
  contactAttributes: {},
  singleUseId: null,
  language: "en",
  displayId,
  contact: null, // Transformed structure
  tags: [], // Transformed structure
  notes: [], // Transformed structure
};

const mockEnvironmentIds = [environmentId, "env-2"];
const mockLimit = 10;
const mockOffset = 5;

const mockResponsesPrisma = [mockResponsePrisma, { ...mockResponsePrisma, id: "response-2" }];
const mockTransformedResponses = [mockResponse, { ...mockResponse, id: "response-2" }];

// Mock dependencies
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: true,
  POSTHOG_API_KEY: "mock-posthog-api-key",
  POSTHOG_HOST: "mock-posthog-host",
  IS_POSTHOG_CONFIGURED: true,
  ENCRYPTION_KEY: "mock-encryption-key",
  ENTERPRISE_LICENSE_KEY: "mock-enterprise-license-key",
  GITHUB_ID: "mock-github-id",
  GITHUB_SECRET: "test-githubID",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  AZUREAD_CLIENT_ID: "test-azuread-client-id",
  AZUREAD_CLIENT_SECRET: "test-azure",
  AZUREAD_TENANT_ID: "test-azuread-tenant-id",
  OIDC_DISPLAY_NAME: "test-oidc-display-name",
  OIDC_CLIENT_ID: "test-oidc-client-id",
  OIDC_ISSUER: "test-oidc-issuer",
  OIDC_CLIENT_SECRET: "test-oidc-client-secret",
  OIDC_SIGNING_ALGORITHM: "test-oidc-signing-algorithm",
  WEBAPP_URL: "test-webapp-url",
  IS_PRODUCTION: false,
  SENTRY_DSN: "mock-sentry-dsn",
}));
vi.mock("@/lib/organization/service");
vi.mock("@/lib/posthogServer");
vi.mock("@/lib/response/service");
vi.mock("@/lib/response/utils");
vi.mock("@/lib/telemetry");
vi.mock("@/lib/utils/validate");
vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));
vi.mock("@formbricks/logger");
vi.mock("./contact");

describe("Response Lib Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createResponse", () => {
    test("should create a response successfully with userId", async () => {
      const mockContact = { id: "contact1", attributes: { userId: mockUserId } };
      vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrganization);
      vi.mocked(getContactByUserId).mockResolvedValue(mockContact);
      vi.mocked(calculateTtcTotal).mockReturnValue({ total: 10 });
      vi.mocked(prisma.response.create).mockResolvedValue({
        ...mockResponsePrisma,
      });
      vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(50);

      const response = await createResponse(mockResponseInputWithUserId);

      expect(getOrganizationByEnvironmentId).toHaveBeenCalledWith(environmentId);
      expect(getContactByUserId).toHaveBeenCalledWith(environmentId, mockUserId);
      expect(prisma.response.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contact: { connect: { id: mockContact.id } },
            contactAttributes: mockContact.attributes,
          }),
        })
      );
      expect(response.contact).toEqual({ id: mockContact.id, userId: mockUserId });
    });

    test("should throw ResourceNotFoundError if organization not found", async () => {
      vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(null);
      await expect(createResponse(mockResponseInput)).rejects.toThrow(ResourceNotFoundError);
      expect(getOrganizationByEnvironmentId).toHaveBeenCalledWith(environmentId);
      expect(prisma.response.create).not.toHaveBeenCalled();
    });

    test("should handle PrismaClientKnownRequestError", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("DB error", {
        code: "P2002",
        clientVersion: "2.0",
      });
      vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrganization);
      vi.mocked(prisma.response.create).mockRejectedValue(prismaError);

      await expect(createResponse(mockResponseInput)).rejects.toThrow(DatabaseError);
      expect(logger.error).not.toHaveBeenCalled(); // Should be caught and re-thrown as DatabaseError
    });

    test("should handle RelatedRecordDoesNotExist error with specific message", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Related record does not exist", {
        code: "P2025", // PrismaErrorType.RelatedRecordDoesNotExist
        clientVersion: "2.0",
      });
      vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrganization);
      vi.mocked(prisma.response.create).mockRejectedValue(prismaError);

      await expect(createResponse(mockResponseInput)).rejects.toThrow(DatabaseError);
      await expect(createResponse(mockResponseInput)).rejects.toThrow("Display ID does not exist");
    });

    test("should handle generic errors", async () => {
      const genericError = new Error("Something went wrong");
      vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrganization);
      vi.mocked(prisma.response.create).mockRejectedValue(genericError);

      await expect(createResponse(mockResponseInput)).rejects.toThrow(genericError);
    });

    describe("Cloud specific tests", () => {
      test("should check response limit and send event if limit reached", async () => {
        // IS_FORMBRICKS_CLOUD is true by default from the top-level mock
        const limit = 100;
        const mockOrgWithBilling = {
          ...mockOrganization,
          billing: { limits: { monthly: { responses: limit } } },
        } as any;
        vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrgWithBilling);
        vi.mocked(calculateTtcTotal).mockReturnValue({ total: 10 });
        vi.mocked(prisma.response.create).mockResolvedValue(mockResponsePrisma);
        vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(limit); // Limit reached

        await createResponse(mockResponseInput);

        expect(getMonthlyOrganizationResponseCount).toHaveBeenCalledWith(organizationId);
        expect(sendPlanLimitsReachedEventToPosthogWeekly).toHaveBeenCalled();
      });

      test("should check response limit and not send event if limit not reached", async () => {
        const limit = 100;
        const mockOrgWithBilling = {
          ...mockOrganization,
          billing: { limits: { monthly: { responses: limit } } },
        } as any;
        vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrgWithBilling);
        vi.mocked(calculateTtcTotal).mockReturnValue({ total: 10 });
        vi.mocked(prisma.response.create).mockResolvedValue(mockResponsePrisma);
        vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(limit - 1); // Limit not reached

        await createResponse(mockResponseInput);

        expect(getMonthlyOrganizationResponseCount).toHaveBeenCalledWith(organizationId);
        expect(sendPlanLimitsReachedEventToPosthogWeekly).not.toHaveBeenCalled();
      });

      test("should log error if sendPlanLimitsReachedEventToPosthogWeekly fails", async () => {
        const limit = 100;
        const mockOrgWithBilling = {
          ...mockOrganization,
          billing: { limits: { monthly: { responses: limit } } },
        } as any;
        const posthogError = new Error("Posthog error");
        vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrgWithBilling);
        vi.mocked(calculateTtcTotal).mockReturnValue({ total: 10 });
        vi.mocked(prisma.response.create).mockResolvedValue(mockResponsePrisma);
        vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(limit); // Limit reached
        vi.mocked(sendPlanLimitsReachedEventToPosthogWeekly).mockRejectedValue(posthogError);

        // Expecting successful response creation despite PostHog error
        const response = await createResponse(mockResponseInput);

        expect(getMonthlyOrganizationResponseCount).toHaveBeenCalledWith(organizationId);
        expect(sendPlanLimitsReachedEventToPosthogWeekly).toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(
          posthogError,
          "Error sending plan limits reached event to Posthog"
        );
        expect(response).toEqual(mockResponse); // Should still return the created response
      });
    });
  });

  describe("getResponsesByEnvironmentIds", () => {
    test("should return responses successfully", async () => {
      vi.mocked(prisma.response.findMany).mockResolvedValue(mockResponsesPrisma);
      vi.mocked(getResponseContact).mockReturnValue(null); // Assume no contact for simplicity

      const responses = await getResponsesByEnvironmentIds(mockEnvironmentIds);

      expect(validateInputs).toHaveBeenCalledTimes(1);
      expect(prisma.response.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            survey: {
              environmentId: { in: mockEnvironmentIds },
            },
          },
          orderBy: [{ createdAt: "desc" }],
          take: undefined,
          skip: undefined,
        })
      );
      expect(getResponseContact).toHaveBeenCalledTimes(mockResponsesPrisma.length);
      expect(responses).toEqual(mockTransformedResponses);
    });

    test("should return responses with limit and offset", async () => {
      vi.mocked(prisma.response.findMany).mockResolvedValue(mockResponsesPrisma);
      vi.mocked(getResponseContact).mockReturnValue(null);

      await getResponsesByEnvironmentIds(mockEnvironmentIds, mockLimit, mockOffset);

      expect(prisma.response.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: mockLimit,
          skip: mockOffset,
        })
      );
    });

    test("should return empty array if no responses found", async () => {
      vi.mocked(prisma.response.findMany).mockResolvedValue([]);

      const responses = await getResponsesByEnvironmentIds(mockEnvironmentIds);

      expect(responses).toEqual([]);
      expect(prisma.response.findMany).toHaveBeenCalled();
      expect(getResponseContact).not.toHaveBeenCalled();
    });

    test("should handle PrismaClientKnownRequestError", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("DB error", {
        code: "P2002",
        clientVersion: "2.0",
      });
      vi.mocked(prisma.response.findMany).mockRejectedValue(prismaError);

      await expect(getResponsesByEnvironmentIds(mockEnvironmentIds)).rejects.toThrow(DatabaseError);
    });

    test("should handle generic errors", async () => {
      const genericError = new Error("Something went wrong");
      vi.mocked(prisma.response.findMany).mockRejectedValue(genericError);

      await expect(getResponsesByEnvironmentIds(mockEnvironmentIds)).rejects.toThrow(genericError);
    });
  });
});
