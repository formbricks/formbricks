import { createCacheKey } from "@/modules/cache/lib/cacheKeys";
import { withCache } from "@/modules/cache/lib/withCache";
import { transformPrismaSurvey } from "@/modules/survey/lib/utils";
import { Prisma } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  getExistingContactResponse,
  getOrganizationBilling,
  getResponseBySingleUseId,
  getSurveyMetadata,
  getSurveyWithMetadata,
  isSurveyResponsePresent,
} from "./data";

// Mock dependencies
vi.mock("@/modules/cache/lib/cacheKeys", () => ({
  createCacheKey: {
    survey: {
      metadata: vi.fn(),
    },
    organization: {
      billing: vi.fn(),
    },
  },
}));

vi.mock("@/modules/cache/lib/withCache", () => ({
  withCache: vi.fn(),
}));

vi.mock("@/modules/survey/lib/utils", () => ({
  transformPrismaSurvey: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      findUnique: vi.fn(),
    },
    response: {
      findFirst: vi.fn(),
    },
    organization: {
      findFirst: vi.fn(),
    },
  },
}));

// Mock React cache
vi.mock("react", () => ({
  cache: vi.fn((fn) => fn),
}));

describe("data", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getSurveyWithMetadata", () => {
    const mockSurveyData = {
      id: "survey-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Survey",
      type: "link",
      environmentId: "env-1",
      createdBy: "user-1",
      status: "inProgress",
      welcomeCard: {
        enabled: true,
        timeToFinish: false,
        showResponseCount: false,
        headline: { default: "Welcome" },
        html: { default: "" },
        buttonLabel: { default: "Start" },
      },
      questions: [],
      endings: [],
      hiddenFields: {},
      variables: [],
      displayOption: "displayOnce",
      recontactDays: null,
      displayLimit: null,
      autoClose: null,
      runOnDate: null,
      closeOnDate: null,
      delay: 0,
      displayPercentage: null,
      autoComplete: null,
      isVerifyEmailEnabled: false,
      isSingleResponsePerEmailEnabled: false,
      redirectUrl: null,
      pin: null,
      resultShareKey: null,
      isBackButtonHidden: false,
      singleUse: null,
      projectOverwrites: null,
      styling: null,
      surveyClosedMessage: null,
      showLanguageSwitch: null,
      recaptcha: null,
      languages: [],
      triggers: [],
      segment: null,
      followUps: [],
      thankYouCard: {
        enabled: false,
        headline: { default: "Thank you!" },
        subheader: { default: "" },
        buttonLabel: { default: "Close" },
      },
      inlineTriggers: [],
      segmentId: null,
      verifyEmail: null,
    };

    const mockTransformedSurvey = {
      ...mockSurveyData,
      displayPercentage: null,
      segment: null,
    } as unknown as TSurvey;

    test("should fetch and transform survey data successfully", async () => {
      const surveyId = "survey-1";

      vi.mocked(prisma.survey.findUnique).mockResolvedValue(mockSurveyData as any);
      vi.mocked(transformPrismaSurvey).mockReturnValue(mockTransformedSurvey);

      const result = await getSurveyWithMetadata(surveyId);

      expect(result).toEqual(mockTransformedSurvey);
      expect(prisma.survey.findUnique).toHaveBeenCalledWith({
        where: { id: surveyId },
        select: expect.objectContaining({
          id: true,
          name: true,
          type: true,
        }),
      });
      expect(transformPrismaSurvey).toHaveBeenCalledWith(mockSurveyData);
    });

    test("should throw ResourceNotFoundError when survey not found", async () => {
      const surveyId = "nonexistent-survey";

      vi.mocked(prisma.survey.findUnique).mockResolvedValue(null);

      await expect(getSurveyWithMetadata(surveyId)).rejects.toThrow(ResourceNotFoundError);
      await expect(getSurveyWithMetadata(surveyId)).rejects.toThrow("Survey");
    });

    test("should throw DatabaseError on Prisma error", async () => {
      const surveyId = "survey-1";
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2025",
        clientVersion: "5.0.0",
      });

      vi.mocked(prisma.survey.findUnique).mockRejectedValue(prismaError);

      await expect(getSurveyWithMetadata(surveyId)).rejects.toThrow(DatabaseError);
    });

    test("should rethrow non-Prisma errors", async () => {
      const surveyId = "survey-1";
      const genericError = new Error("Generic error");

      vi.mocked(prisma.survey.findUnique).mockRejectedValue(genericError);

      await expect(getSurveyWithMetadata(surveyId)).rejects.toThrow(genericError);
    });
  });

  describe("getSurveyMetadata", () => {
    const mockFullSurvey = {
      id: "survey-1",
      type: "link",
      status: "inProgress",
      environmentId: "env-1",
      name: "Test Survey",
      styling: { primaryColor: "#000" },
      // Additional fields that should not be in metadata
      questions: [],
      welcomeCard: { enabled: true },
      createdAt: new Date(),
    } as unknown as TSurvey;

    test("should extract metadata from full survey", async () => {
      const surveyId = "survey-1";

      // Mock the survey data that getSurveyWithMetadata would return
      const mockSurveyData = {
        id: "survey-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        name: "Test Survey",
        type: "link",
        environmentId: "env-1",
        createdBy: "user-1",
        status: "inProgress",
        styling: { primaryColor: "#000" },
        // Add other required fields
        welcomeCard: { enabled: true },
        questions: [],
        endings: [],
        hiddenFields: {},
        variables: [],
        displayOption: "displayOnce",
        recontactDays: null,
        displayLimit: null,
        autoClose: null,
        runOnDate: null,
        closeOnDate: null,
        delay: 0,
        displayPercentage: null,
        autoComplete: null,
        isVerifyEmailEnabled: false,
        isSingleResponsePerEmailEnabled: false,
        redirectUrl: null,
        pin: null,
        resultShareKey: null,
        isBackButtonHidden: false,
        singleUse: null,
        projectOverwrites: null,
        surveyClosedMessage: null,
        showLanguageSwitch: null,
        recaptcha: null,
        languages: [],
        triggers: [],
        segment: null,
        followUps: [],
        thankYouCard: {
          enabled: false,
          headline: { default: "Thank you!" },
          subheader: { default: "" },
          buttonLabel: { default: "Close" },
        },
      };

      vi.mocked(prisma.survey.findUnique).mockResolvedValue(mockSurveyData as any);
      vi.mocked(transformPrismaSurvey).mockReturnValue(mockFullSurvey);

      const result = await getSurveyMetadata(surveyId);

      expect(result).toEqual({
        id: "survey-1",
        type: "link",
        status: "inProgress",
        environmentId: "env-1",
        name: "Test Survey",
        styling: { primaryColor: "#000" },
      });

      // Ensure it doesn't contain other fields
      expect(result).not.toHaveProperty("questions");
      expect(result).not.toHaveProperty("welcomeCard");
      expect(result).not.toHaveProperty("createdAt");
    });
  });

  describe("getResponseBySingleUseId", () => {
    const mockResponse = {
      id: "response-1",
      finished: true,
      createdAt: new Date(),
      data: { answer1: "test" },
    };

    test("should find response by single use ID", async () => {
      const surveyId = "survey-1";
      const singleUseId = "single-use-1";

      vi.mocked(prisma.response.findFirst).mockResolvedValue(mockResponse as any);

      const result = await getResponseBySingleUseId(surveyId, singleUseId)();

      expect(result).toEqual(mockResponse);
      expect(prisma.response.findFirst).toHaveBeenCalledWith({
        where: {
          surveyId,
          singleUseId,
        },
        select: {
          id: true,
          finished: true,
          createdAt: true,
          data: true,
        },
      });
    });

    test("should return null when response not found", async () => {
      const surveyId = "survey-1";
      const singleUseId = "nonexistent-single-use";

      vi.mocked(prisma.response.findFirst).mockResolvedValue(null);

      const result = await getResponseBySingleUseId(surveyId, singleUseId)();

      expect(result).toBeNull();
    });

    test("should throw DatabaseError on Prisma error", async () => {
      const surveyId = "survey-1";
      const singleUseId = "single-use-1";
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2025",
        clientVersion: "5.0.0",
      });

      vi.mocked(prisma.response.findFirst).mockRejectedValue(prismaError);

      await expect(getResponseBySingleUseId(surveyId, singleUseId)()).rejects.toThrow(DatabaseError);
    });

    test("should rethrow non-Prisma errors", async () => {
      const surveyId = "survey-1";
      const singleUseId = "single-use-1";
      const genericError = new Error("Generic error");

      vi.mocked(prisma.response.findFirst).mockRejectedValue(genericError);

      await expect(getResponseBySingleUseId(surveyId, singleUseId)()).rejects.toThrow(genericError);
    });
  });

  describe("isSurveyResponsePresent", () => {
    test("should return true when response with email exists", async () => {
      const surveyId = "survey-1";
      const email = "test@example.com";
      const mockResponse = { id: "response-1" };

      vi.mocked(prisma.response.findFirst).mockResolvedValue(mockResponse as any);

      const result = await isSurveyResponsePresent(surveyId, email)();

      expect(result).toBe(true);
      expect(prisma.response.findFirst).toHaveBeenCalledWith({
        where: {
          surveyId,
          data: {
            path: ["verifiedEmail"],
            equals: email,
          },
        },
        select: { id: true },
      });
    });

    test("should return false when no response with email exists", async () => {
      const surveyId = "survey-1";
      const email = "nonexistent@example.com";

      vi.mocked(prisma.response.findFirst).mockResolvedValue(null);

      const result = await isSurveyResponsePresent(surveyId, email)();

      expect(result).toBe(false);
    });

    test("should throw DatabaseError on Prisma error", async () => {
      const surveyId = "survey-1";
      const email = "test@example.com";
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2025",
        clientVersion: "5.0.0",
      });

      vi.mocked(prisma.response.findFirst).mockRejectedValue(prismaError);

      await expect(isSurveyResponsePresent(surveyId, email)()).rejects.toThrow(DatabaseError);
    });

    test("should rethrow non-Prisma errors", async () => {
      const surveyId = "survey-1";
      const email = "test@example.com";
      const genericError = new Error("Generic error");

      vi.mocked(prisma.response.findFirst).mockRejectedValue(genericError);

      await expect(isSurveyResponsePresent(surveyId, email)()).rejects.toThrow(genericError);
    });
  });

  describe("getExistingContactResponse", () => {
    const mockResponse = {
      id: "response-1",
      finished: false,
    };

    test("should find existing contact response", async () => {
      const surveyId = "survey-1";
      const contactId = "contact-1";

      vi.mocked(prisma.response.findFirst).mockResolvedValue(mockResponse as any);

      const result = await getExistingContactResponse(surveyId, contactId)();

      expect(result).toEqual(mockResponse);
      expect(prisma.response.findFirst).toHaveBeenCalledWith({
        where: {
          surveyId,
          contactId,
        },
        select: {
          id: true,
          finished: true,
        },
      });
    });

    test("should return null when contact response not found", async () => {
      const surveyId = "survey-1";
      const contactId = "nonexistent-contact";

      vi.mocked(prisma.response.findFirst).mockResolvedValue(null);

      const result = await getExistingContactResponse(surveyId, contactId)();

      expect(result).toBeNull();
    });

    test("should throw DatabaseError on Prisma error", async () => {
      const surveyId = "survey-1";
      const contactId = "contact-1";
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2025",
        clientVersion: "5.0.0",
      });

      vi.mocked(prisma.response.findFirst).mockRejectedValue(prismaError);

      await expect(getExistingContactResponse(surveyId, contactId)()).rejects.toThrow(DatabaseError);
    });

    test("should rethrow non-Prisma errors", async () => {
      const surveyId = "survey-1";
      const contactId = "contact-1";
      const genericError = new Error("Generic error");

      vi.mocked(prisma.response.findFirst).mockRejectedValue(genericError);

      await expect(getExistingContactResponse(surveyId, contactId)()).rejects.toThrow(genericError);
    });
  });

  describe("getOrganizationBilling", () => {
    const mockBilling = {
      plan: "pro" as const,
      stripeCustomerId: "cus_123",
      period: "monthly" as const,
      limits: {
        monthly: {
          responses: 1000,
          miu: 5000,
        },
      },
      periodStart: new Date(),
    };

    const mockOrganization = {
      id: "org-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Organization",
      billing: mockBilling,
      whitelabel: null,
      isAIEnabled: true,
    };

    test("should fetch organization billing successfully", async () => {
      const organizationId = "org-1";
      const mockCacheFunction = vi.fn().mockResolvedValue(mockBilling);

      vi.mocked(createCacheKey.organization.billing).mockReturnValue("billing-cache-key");
      vi.mocked(withCache).mockReturnValue(mockCacheFunction);
      vi.mocked(prisma.organization.findFirst).mockResolvedValue(mockOrganization as any);

      const result = await getOrganizationBilling(organizationId);

      expect(result).toEqual(mockBilling);
      expect(createCacheKey.organization.billing).toHaveBeenCalledWith(organizationId);
      expect(withCache).toHaveBeenCalledWith(expect.any(Function), {
        key: "billing-cache-key",
        ttl: 60 * 60 * 24 * 1000,
      });
    });

    test("should throw ResourceNotFoundError when organization not found", async () => {
      const organizationId = "nonexistent-org";
      const mockCacheFunction = vi.fn().mockImplementation(async () => {
        vi.mocked(prisma.organization.findFirst).mockResolvedValue(null);
        const cacheFunction = vi.mocked(withCache).mock.calls[0][0];
        return await cacheFunction();
      });

      vi.mocked(createCacheKey.organization.billing).mockReturnValue("billing-cache-key");
      vi.mocked(withCache).mockReturnValue(mockCacheFunction);

      await expect(getOrganizationBilling(organizationId)).rejects.toThrow(ResourceNotFoundError);
      await expect(getOrganizationBilling(organizationId)).rejects.toThrow("Organization");
    });

    test("should throw DatabaseError on Prisma error", async () => {
      const organizationId = "org-1";
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2025",
        clientVersion: "5.0.0",
      });

      const mockCacheFunction = vi.fn().mockImplementation(async () => {
        vi.mocked(prisma.organization.findFirst).mockRejectedValue(prismaError);
        const cacheFunction = vi.mocked(withCache).mock.calls[0][0];
        return await cacheFunction();
      });

      vi.mocked(createCacheKey.organization.billing).mockReturnValue("billing-cache-key");
      vi.mocked(withCache).mockReturnValue(mockCacheFunction);

      await expect(getOrganizationBilling(organizationId)).rejects.toThrow(DatabaseError);
    });

    test("should rethrow non-Prisma errors", async () => {
      const organizationId = "org-1";
      const genericError = new Error("Generic error");

      const mockCacheFunction = vi.fn().mockImplementation(async () => {
        vi.mocked(prisma.organization.findFirst).mockRejectedValue(genericError);
        const cacheFunction = vi.mocked(withCache).mock.calls[0][0];
        return await cacheFunction();
      });

      vi.mocked(createCacheKey.organization.billing).mockReturnValue("billing-cache-key");
      vi.mocked(withCache).mockReturnValue(mockCacheFunction);

      await expect(getOrganizationBilling(organizationId)).rejects.toThrow(genericError);
    });
  });
});
