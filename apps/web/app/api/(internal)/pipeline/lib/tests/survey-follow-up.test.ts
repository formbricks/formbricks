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
} from "@/app/api/(internal)/pipeline/lib/tests/__mocks__/survey-follow-up.mock";
import { sendFollowUpEmail } from "@/modules/email";
import { describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { TOrganization } from "@formbricks/types/organizations";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { evaluateFollowUp, sendSurveyFollowUps } from "../survey-follow-up";

// Mock dependencies
vi.mock("@/modules/email", () => ({
  sendFollowUpEmail: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("Survey Follow Up", () => {
  const mockOrganization: Partial<TOrganization> = {
    id: "org1",
    name: "Test Org",
    whitelabel: {
      logoUrl: "https://example.com/logo.png",
    },
  };

  describe("evaluateFollowUp", () => {
    test("sends email when to is a direct email address", async () => {
      const followUpId = mockDirectEmailFollowUp.id;
      const followUpAction = mockDirectEmailFollowUp.action;

      await evaluateFollowUp(
        followUpId,
        followUpAction,
        mockSurvey,
        mockResponse,
        mockOrganization as TOrganization
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

    test("sends email when to is a question ID with valid email", async () => {
      const followUpId = mockResponseEmailFollowUp.id;
      const followUpAction = mockResponseEmailFollowUp.action;

      await evaluateFollowUp(
        followUpId,
        followUpAction,
        mockSurvey as TSurvey,
        mockResponse as TResponse,
        mockOrganization as TOrganization
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
        mockSurveyWithContactQuestion,
        mockResponseWithContactQuestion,
        mockOrganization as TOrganization
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

    test("throws error when to value is not found in response data", async () => {
      const followUpId = "followup1";
      const followUpAction = {
        ...mockSurvey.followUps![0].action,
        properties: {
          ...mockSurvey.followUps![0].action.properties,
          to: "nonExistentField",
        },
      };

      await expect(
        evaluateFollowUp(
          followUpId,
          followUpAction,
          mockSurvey as TSurvey,
          mockResponse as TResponse,
          mockOrganization as TOrganization
        )
      ).rejects.toThrow(`"To" value not found in response data for followup: ${followUpId}`);
    });

    test("throws error when email address is invalid", async () => {
      const followUpId = mockResponseEmailFollowUp.id;
      const followUpAction = mockResponseEmailFollowUp.action;

      const invalidResponse = {
        ...mockResponse,
        data: {
          [mockResponseEmailFollowUp.action.properties.to]: "invalid-email",
        },
      };

      await expect(
        evaluateFollowUp(
          followUpId,
          followUpAction,
          mockSurvey,
          invalidResponse,
          mockOrganization as TOrganization
        )
      ).rejects.toThrow(`Email address is not valid for followup: ${followUpId}`);
    });
  });

  describe("sendSurveyFollowUps", () => {
    test("skips follow-up when ending Id doesn't match", async () => {
      const responseWithDifferentEnding = {
        ...mockResponse,
        endingId: mockEndingId2,
      };

      const mockSurveyWithEndingFollowUp: TSurvey = {
        ...mockSurvey,
        followUps: [mockEndingFollowUp],
      };

      const results = await sendSurveyFollowUps(
        mockSurveyWithEndingFollowUp,
        responseWithDifferentEnding as TResponse,
        mockOrganization as TOrganization
      );

      expect(results).toEqual([
        {
          followUpId: mockEndingFollowUp.id,
          status: "skipped",
        },
      ]);
      expect(sendFollowUpEmail).not.toHaveBeenCalled();
    });

    test("processes follow-ups and log errors", async () => {
      const error = new Error("Test error");
      vi.mocked(sendFollowUpEmail).mockRejectedValueOnce(error);

      const mockSurveyWithFollowUps: TSurvey = {
        ...mockSurvey,
        followUps: [mockResponseEmailFollowUp],
      };

      const results = await sendSurveyFollowUps(
        mockSurveyWithFollowUps,
        mockResponse,
        mockOrganization as TOrganization
      );

      expect(results).toEqual([
        {
          followUpId: mockResponseEmailFollowUp.id,
          status: "error",
          error: "Test error",
        },
      ]);
      expect(logger.error).toHaveBeenCalledWith(
        [`FollowUp ${mockResponseEmailFollowUp.id} failed: Test error`],
        "Follow-up processing errors"
      );
    });

    test("successfully processes follow-ups", async () => {
      vi.mocked(sendFollowUpEmail).mockResolvedValueOnce(undefined);

      const mockSurveyWithFollowUp: TSurvey = {
        ...mockSurvey,
        followUps: [mockDirectEmailFollowUp],
      };

      const results = await sendSurveyFollowUps(
        mockSurveyWithFollowUp,
        mockResponse,
        mockOrganization as TOrganization
      );

      expect(results).toEqual([
        {
          followUpId: mockDirectEmailFollowUp.id,
          status: "success",
        },
      ]);
      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});
