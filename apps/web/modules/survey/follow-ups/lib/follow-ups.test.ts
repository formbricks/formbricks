import {
  mockContactEmailFollowUp,
  mockDirectEmailFollowUp,
  mockEndingFollowUp,
  mockEndingId2,
  mockResponse,
  mockResponseEmailFollowUp,
  mockResponseWithContactQuestion,
  mockSurvey,
  mockSurveyWithContactQuestion,
} from "@/app/api/(internal)/pipeline/lib/__mocks__/survey-follow-up.mock";
import { getOrganization } from "@/lib/organization/service";
import { getResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { sendFollowUpEmail } from "@/modules/email";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { FollowUpSendError } from "@/modules/survey/follow-ups/types/follow-up";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { TOrganization, TOrganizationBillingPlan } from "@formbricks/types/organizations";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { evaluateFollowUp, sendSurveyFollowUps } from "./follow-ups";

// Mock dependencies
vi.mock("@/modules/email", () => ({
  sendFollowUpEmail: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganization: vi.fn(),
}));

vi.mock("@/lib/response/service", () => ({
  getResponse: vi.fn(),
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: vi.fn(),
}));

const mockActualLimiter = vi.fn();
vi.mock("@/lib/utils/rate-limit", () => ({
  rateLimit: vi.fn(() => vi.fn()),
}));

vi.mock("@/modules/survey/follow-ups/lib/utils", () => ({
  getSurveyFollowUpsPermission: vi.fn(),
}));

const getOrganizationMock = () => vi.mocked(getOrganization);
const getResponseMock = () => vi.mocked(getResponse);
const getSurveyMock = () => vi.mocked(getSurvey);

const getSurveyFollowUpsPermissionMock = () => vi.mocked(getSurveyFollowUpsPermission);

describe("Survey Follow Up", () => {
  const mockOrganizationPartial: Partial<TOrganization> = {
    id: "org1",
    name: "Test Org",
    whitelabel: {
      logoUrl: "https://example.com/logo.png",
    },
  };

  const mockOrganizationFull: TOrganization = {
    id: "org1",
    name: "Test Org",
    createdAt: new Date(),
    updatedAt: new Date(),
    ownerId: "owner1",
    invites: [],
    members: [],
    environments: [],
    billing: {
      plan: "free" as TOrganizationBillingPlan,
      stripeCustomerId: null,
      subscriptionStatus: "active",
      features: {
        ai: { status: "inactive", responses: null, openaiApiKey: null },
        linkSurvey: { status: "active" },
        inAppSurvey: { status: "active" },
        userTargeting: { status: "active" },
        teamMembers: { status: "active" },
      },
    },
    whitelabel: {
      logoUrl: "https://example.com/logo.png",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockActualLimiter.mockResolvedValue(undefined);
  });

  describe("evaluateFollowUp", () => {
    test("sends email when to is a direct email address", async () => {
      const followUpId = mockDirectEmailFollowUp.id;
      const followUpAction = mockDirectEmailFollowUp.action;

      await evaluateFollowUp(
        followUpId,
        followUpAction,
        mockSurvey as TSurvey,
        mockResponse as TResponse,
        mockOrganizationPartial as TOrganization
      );

      expect(sendFollowUpEmail).toHaveBeenCalledWith({
        html: mockDirectEmailFollowUp.action.properties.body,
        subject: mockDirectEmailFollowUp.action.properties.subject,
        to: mockDirectEmailFollowUp.action.properties.to,
        replyTo: mockDirectEmailFollowUp.action.properties.replyTo,
        survey: mockSurvey,
        response: mockResponse,
        attachResponseData: true,
        logoUrl: "https://example.com/logo.png",
      });
    });

    test("handles error when sendFollowUpEmail throws for direct email", async () => {
      const followUpId = mockDirectEmailFollowUp.id;
      const followUpAction = mockDirectEmailFollowUp.action;
      const errorMessage = "Email sending failed";
      vi.mocked(sendFollowUpEmail).mockRejectedValueOnce(new Error(errorMessage));

      const result = await evaluateFollowUp(
        followUpId,
        followUpAction,
        mockSurvey,
        mockResponse,
        mockOrganizationPartial as TOrganization
      );

      expect(result).toEqual({
        followUpId,
        status: "error",
        error: errorMessage,
      });
      expect(sendFollowUpEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockDirectEmailFollowUp.action.properties.to,
        })
      );
    });

    test("sends email with empty logoUrl if not in organization whitelabel", async () => {
      const followUpId = mockDirectEmailFollowUp.id;
      const followUpAction = mockDirectEmailFollowUp.action;
      const orgWithoutLogo = { ...mockOrganizationPartial, whitelabel: null };

      await evaluateFollowUp(
        followUpId,
        followUpAction,
        mockSurvey as TSurvey,
        mockResponse as TResponse,
        orgWithoutLogo as TOrganization
      );

      expect(sendFollowUpEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          logoUrl: "",
        })
      );
    });

    test("sends email when to is a question ID with valid email", async () => {
      const followUpId = mockResponseEmailFollowUp.id;
      const followUpAction = mockResponseEmailFollowUp.action;

      await evaluateFollowUp(
        followUpId,
        followUpAction,
        mockSurvey as TSurvey,
        mockResponse as TResponse,
        mockOrganizationPartial as TOrganization
      );

      expect(sendFollowUpEmail).toHaveBeenCalledWith({
        html: mockResponseEmailFollowUp.action.properties.body,
        subject: mockResponseEmailFollowUp.action.properties.subject,
        to: mockResponse.data[mockResponseEmailFollowUp.action.properties.to],
        replyTo: mockResponseEmailFollowUp.action.properties.replyTo,
        survey: mockSurvey,
        response: mockResponse,
        attachResponseData: true,
        logoUrl: "https://example.com/logo.png",
      });
    });

    test("sends email when to is a question ID with valid email in array", async () => {
      const followUpId = mockContactEmailFollowUp.id;
      const followUpAction = mockContactEmailFollowUp.action;

      await evaluateFollowUp(
        followUpId,
        followUpAction,
        mockSurveyWithContactQuestion as TSurvey,
        mockResponseWithContactQuestion as TResponse,
        mockOrganizationPartial as TOrganization
      );

      expect(sendFollowUpEmail).toHaveBeenCalledWith({
        html: mockContactEmailFollowUp.action.properties.body,
        subject: mockContactEmailFollowUp.action.properties.subject,
        to: mockResponseWithContactQuestion.data[mockContactEmailFollowUp.action.properties.to][2],
        replyTo: mockContactEmailFollowUp.action.properties.replyTo,
        survey: mockSurveyWithContactQuestion,
        response: mockResponseWithContactQuestion,
        attachResponseData: true,
        logoUrl: "https://example.com/logo.png",
      });
    });

    test("returns error when to value is not found in response data", async () => {
      const followUpId = "followup1";
      const followUpAction = {
        ...mockSurvey.followUps![0].action,
        properties: {
          ...mockSurvey.followUps![0].action.properties,
          to: "nonExistentField",
        },
      };

      const result = await evaluateFollowUp(
        followUpId,
        followUpAction,
        mockSurvey as TSurvey,
        mockResponse as TResponse,
        mockOrganizationPartial as TOrganization
      );
      expect(result.status).toBe("error");
      expect(result.error).toBe(`To value not found in response data for followup: ${followUpId}`);
    });

    test("returns error when email address from response data (string) is invalid", async () => {
      const followUpId = mockResponseEmailFollowUp.id;
      const followUpAction = mockResponseEmailFollowUp.action;

      const invalidResponse = {
        ...mockResponse,
        data: {
          [mockResponseEmailFollowUp.action.properties.to]: "invalid-email",
        },
      } as TResponse;

      const result = await evaluateFollowUp(
        followUpId,
        followUpAction,
        mockSurvey as TSurvey,
        invalidResponse,
        mockOrganizationPartial as TOrganization
      );
      expect(result.status).toBe("error");
      expect(result.error).toBe(`Email address is not valid for followup: ${followUpId}`);
    });

    test("returns error when email address from response data (array) is not found", async () => {
      const followUpId = mockContactEmailFollowUp.id;
      const followUpAction = mockContactEmailFollowUp.action;
      const responseWithMissingEmailInArray = {
        ...mockResponseWithContactQuestion,
        data: {
          ...mockResponseWithContactQuestion.data,
          [mockContactEmailFollowUp.action.properties.to]: ["firstName", "lastName", undefined],
        },
      } as TResponse;

      const result = await evaluateFollowUp(
        followUpId,
        followUpAction,
        mockSurveyWithContactQuestion as TSurvey,
        responseWithMissingEmailInArray,
        mockOrganizationPartial as TOrganization
      );
      expect(result.status).toBe("error");
      expect(result.error).toBe(`Email address not found in response data for followup: ${followUpId}`);
    });

    test("returns error when email address from response data (array) is invalid", async () => {
      const followUpId = mockContactEmailFollowUp.id;
      const followUpAction = mockContactEmailFollowUp.action;
      const responseWithInvalidEmailInArray = {
        ...mockResponseWithContactQuestion,
        data: {
          ...mockResponseWithContactQuestion.data,
          [mockContactEmailFollowUp.action.properties.to]: ["firstName", "lastName", "invalid-email"],
        },
      } as TResponse;

      const result = await evaluateFollowUp(
        followUpId,
        followUpAction,
        mockSurveyWithContactQuestion as TSurvey,
        responseWithInvalidEmailInArray,
        mockOrganizationPartial as TOrganization
      );
      expect(result.status).toBe("error");
      expect(result.error).toBe(`Email address is not valid for followup: ${followUpId}`);
    });
  });

  describe("sendSurveyFollowUps", () => {
    const orgId = "org1";
    const surveyId = "survey1";
    const responseId = "response1";

    beforeEach(() => {
      getOrganizationMock().mockReset();
      getResponseMock().mockReset();
      getSurveyMock().mockReset();
      getSurveyFollowUpsPermissionMock().mockReset();
      mockActualLimiter.mockReset();
      mockActualLimiter.mockResolvedValue(undefined);
      vi.mocked(sendFollowUpEmail).mockClear();
      vi.mocked(logger.error).mockClear();
    });

    test("returns error when rate limit is exceeded", async () => {
      const rateLimitError = new Error("Rate limit exceeded");
      mockActualLimiter.mockRejectedValueOnce(rateLimitError);

      const result = await sendSurveyFollowUps(orgId, surveyId, responseId);

      expect(mockActualLimiter).toHaveBeenCalledWith(orgId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(FollowUpSendError.RATE_LIMIT_EXCEEDED);
        expect(result.error.message).toBe("Too many follow‐up requests; please wait a bit and try again.");
      }
    });

    test("returns error when organization is not found", async () => {
      getOrganizationMock().mockResolvedValueOnce(null);

      const result = await sendSurveyFollowUps(orgId, surveyId, responseId);

      expect(getOrganizationMock()).toHaveBeenCalledWith(orgId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(FollowUpSendError.ORG_NOT_FOUND);
      }
    });

    test("returns error when survey follow-ups are not allowed", async () => {
      getOrganizationMock().mockResolvedValueOnce(mockOrganizationFull);
      getSurveyFollowUpsPermissionMock().mockResolvedValueOnce(false);

      const result = await sendSurveyFollowUps(orgId, surveyId, responseId);

      expect(getSurveyFollowUpsPermissionMock()).toHaveBeenCalledWith(mockOrganizationFull.billing.plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(FollowUpSendError.FOLLOW_UP_NOT_ALLOWED);
      }
    });

    test("returns error when survey is not found", async () => {
      getOrganizationMock().mockResolvedValueOnce(mockOrganizationFull);
      getSurveyFollowUpsPermissionMock().mockResolvedValueOnce(true);
      getSurveyMock().mockResolvedValueOnce(null);

      const result = await sendSurveyFollowUps(orgId, surveyId, responseId);

      expect(getSurveyMock()).toHaveBeenCalledWith(surveyId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(FollowUpSendError.SURVEY_NOT_FOUND);
      }
    });

    test("returns error when response is not found", async () => {
      getOrganizationMock().mockResolvedValueOnce(mockOrganizationFull);
      getSurveyFollowUpsPermissionMock().mockResolvedValueOnce(true);
      getSurveyMock().mockResolvedValueOnce({ ...mockSurvey, id: surveyId } as TSurvey);
      getResponseMock().mockResolvedValueOnce(null);

      const result = await sendSurveyFollowUps(orgId, surveyId, responseId);

      expect(getResponseMock()).toHaveBeenCalledWith(responseId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(FollowUpSendError.RESPONSE_NOT_FOUND);
      }
    });

    test("returns error when response does not belong to the survey", async () => {
      const differentSurveyResponse = { ...mockResponse, surveyId: "anotherSurveyId" } as TResponse;
      getOrganizationMock().mockResolvedValueOnce(mockOrganizationFull);
      getSurveyFollowUpsPermissionMock().mockResolvedValueOnce(true);
      getSurveyMock().mockResolvedValueOnce({ ...mockSurvey, id: surveyId } as TSurvey);
      getResponseMock().mockResolvedValueOnce(differentSurveyResponse);

      const result = await sendSurveyFollowUps(orgId, surveyId, responseId);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(FollowUpSendError.RESPONSE_SURVEY_MISMATCH);
      }
    });

    test("returns empty array when survey has no follow-ups", async () => {
      const surveyWithNoFollowUps = { ...mockSurvey, id: surveyId, followUps: [] } as TSurvey;
      getOrganizationMock().mockResolvedValueOnce(mockOrganizationFull);
      getSurveyFollowUpsPermissionMock().mockResolvedValueOnce(true);
      getSurveyMock().mockResolvedValueOnce(surveyWithNoFollowUps);
      getResponseMock().mockResolvedValueOnce({
        ...mockResponse,
        id: responseId,
        surveyId: surveyId,
      } as TResponse);

      const result = await sendSurveyFollowUps(orgId, surveyId, responseId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual([]);
      }
      expect(sendFollowUpEmail).not.toHaveBeenCalled();
    });

    test("skips follow-up when trigger is 'endings' and response.endingId is null", async () => {
      const responseWithNullEnding = {
        ...mockResponse,
        id: responseId,
        surveyId: surveyId,
        endingId: null,
      } as TResponse;
      const surveyWithEndingFollowUp = {
        ...mockSurvey,
        id: surveyId,
        followUps: [mockEndingFollowUp],
      } as TSurvey;

      getOrganizationMock().mockResolvedValueOnce(mockOrganizationFull);
      getSurveyFollowUpsPermissionMock().mockResolvedValueOnce(true);
      getSurveyMock().mockResolvedValueOnce(surveyWithEndingFollowUp);
      getResponseMock().mockResolvedValueOnce(responseWithNullEnding);

      const result = await sendSurveyFollowUps(orgId, surveyId, responseId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual([
          {
            followUpId: mockEndingFollowUp.id,
            status: "skipped",
          },
        ]);
      }
      expect(sendFollowUpEmail).not.toHaveBeenCalled();
    });

    test("skips follow-up when ending Id doesn't match", async () => {
      const responseWithDifferentEnding = {
        ...mockResponse,
        id: responseId,
        surveyId: surveyId,
        endingId: mockEndingId2,
      } as TResponse;

      const surveyWithEndingFollowUp: TSurvey = {
        ...mockSurvey,
        id: surveyId,
        followUps: [mockEndingFollowUp],
      };

      getOrganizationMock().mockResolvedValueOnce(mockOrganizationFull);
      getSurveyFollowUpsPermissionMock().mockResolvedValueOnce(true);
      getSurveyMock().mockResolvedValueOnce(surveyWithEndingFollowUp);
      getResponseMock().mockResolvedValueOnce(responseWithDifferentEnding);

      const result = await sendSurveyFollowUps(orgId, surveyId, responseId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual([
          {
            followUpId: mockEndingFollowUp.id,
            status: "skipped",
          },
        ]);
      }
      expect(sendFollowUpEmail).not.toHaveBeenCalled();
    });

    // test("processes follow-ups and log errors if any evaluateFollowUp fails", async () => {
    //   const error = new Error("Test error from evaluateFollowUp");
    //   vi.mocked(sendFollowUpEmail).mockRejectedValueOnce(error);

    //   const surveyWithTwoFollowUps: TSurvey = {
    //     ...mockSurvey,
    //     id: surveyId,
    //     followUps: [mockResponseEmailFollowUp, mockDirectEmailFollowUp],
    //   };

    //   getOrganizationMock().mockResolvedValueOnce(mockOrganizationFull);
    //   getSurveyFollowUpsPermissionMock().mockResolvedValueOnce(true);
    //   getSurveyMock().mockResolvedValueOnce(surveyWithTwoFollowUps);
    //   getResponseMock().mockResolvedValueOnce({
    //     ...mockResponse,
    //     id: responseId,
    //     surveyId: surveyId,
    //   } as TResponse);

    //   const result = await sendSurveyFollowUps(orgId, surveyId, responseId);

    //   expect(result.ok).toBe(true);
    //   if (result.ok) {
    //     expect(result.data).toContainEqual({
    //       followUpId: mockResponseEmailFollowUp.id,
    //       status: "error",
    //       error: "Test error from evaluateFollowUp",
    //     });
    //     expect(result.data).toContainEqual({
    //       followUpId: mockDirectEmailFollowUp.id,
    //       status: "success",
    //     });
    //   }
    //   expect(logger.error).toHaveBeenCalledWith(
    //     expect.objectContaining({
    //       errors: expect.arrayContaining([
    //         `FollowUp ${mockResponseEmailFollowUp.id} failed: Test error from evaluateFollowUp`,
    //       ]),
    //     }),
    //     "Follow-up processing errors"
    //   );
    // });

    test("successfully processes all follow-ups", async () => {
      vi.mocked(sendFollowUpEmail).mockResolvedValue(undefined);

      const surveyWithMultipleFollowUps: TSurvey = {
        ...mockSurvey,
        id: surveyId,
        followUps: [mockDirectEmailFollowUp, mockResponseEmailFollowUp],
      };

      getOrganizationMock().mockResolvedValueOnce(mockOrganizationFull);
      getSurveyFollowUpsPermissionMock().mockResolvedValueOnce(true);
      getSurveyMock().mockResolvedValueOnce(surveyWithMultipleFollowUps);
      getResponseMock().mockResolvedValueOnce({
        ...mockResponse,
        id: responseId,
        surveyId: surveyId,
      } as TResponse);

      const result = await sendSurveyFollowUps(orgId, surveyId, responseId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual([
          {
            followUpId: mockDirectEmailFollowUp.id,
            status: "success",
          },
          {
            followUpId: mockResponseEmailFollowUp.id,
            status: "success",
          },
        ]);
      }
      expect(sendFollowUpEmail).toHaveBeenCalledTimes(2);
      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});
