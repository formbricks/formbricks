import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TOrganization } from "@formbricks/types/organizations";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { getResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { FollowUpSendError } from "@/modules/survey/follow-ups/types/follow-up";
import { sendFollowUpEmail } from "./email";
import { sendFollowUpsForResponse } from "./follow-ups";
import { getSurveyFollowUpsPermission } from "./utils";

// Mock all dependencies
vi.mock("@/lib/organization/service", () => ({
  getOrganizationByWorkspaceId: vi.fn(),
}));

vi.mock("@/lib/response/service", () => ({
  getResponse: vi.fn(),
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: vi.fn(),
}));

// Owners resolve to themselves; only team@example.com and direct@example.com are members of the organization.
vi.mock("@/modules/email/lib/email-actor", () => ({
  resolveEmailActorUserId: vi.fn(async (ownerUserId: string | null) => ownerUserId ?? "org-owner"),
  isOrganizationMemberEmail: vi.fn(async (_organizationId: string, email: string) =>
    ["team@example.com", "direct@example.com"].includes(email)
  ),
}));

vi.mock("./email", () => ({
  sendFollowUpEmail: vi.fn(),
}));

vi.mock("./utils", () => ({
  getSurveyFollowUpsPermission: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn(),
}));

describe("Follow-ups", () => {
  const mockResponse = {
    id: "response1",
    surveyId: "survey1",
    data: {
      email: "test@example.com",
      question1: "answer1",
    },
    endingId: "ending1",
  } as unknown as TResponse;

  const mockSurvey = {
    id: "survey1",
    workspaceId: "ws1",
    // The owner carries the per-sender limit; `createdBy` is attribution an API caller may set (ENG-3823).
    ownerId: "owner-1",
    createdBy: "someone-else",
    followUps: [
      {
        id: "followup1",
        action: {
          type: "email",
          properties: {
            to: "email",
            replyTo: "noreply@example.com",
            attachResponseData: true,
          },
        },
        trigger: {
          type: "response",
          properties: {
            endingIds: ["ending1"],
          },
        },
      },
    ],
  } as unknown as TSurvey;

  const mockOrganization = {
    id: "org1",
    billing: {
      limits: {
        monthly: { responses: 1000 },
        workspaces: 3,
      },
      usageCycleAnchor: new Date(),
      stripeCustomerId: "cus123",
    },
    whitelabel: {
      logoUrl: "https://example.com/logo.png",
    },
  } as unknown as TOrganization;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getResponse).mockResolvedValue(mockResponse);
    vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
    vi.mocked(getOrganizationByWorkspaceId).mockResolvedValue(mockOrganization);
    vi.mocked(getSurveyFollowUpsPermission).mockResolvedValue(true);
    vi.mocked(sendFollowUpEmail).mockResolvedValue(undefined);
    vi.mocked(applyRateLimit).mockResolvedValue({ allowed: true });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("sendFollowUpsForResponse", () => {
    test("should successfully send follow-up emails", async () => {
      const result = await sendFollowUpsForResponse("response1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toEqual({
          followUpId: "followup1",
          status: "success",
        });
        expect(sendFollowUpEmail).toHaveBeenCalledWith({
          followUp: mockSurvey.followUps[0],
          to: "test@example.com",
          replyTo: "noreply@example.com",
          survey: mockSurvey,
          response: mockResponse,
          attachResponseData: true,
          logoUrl: "https://example.com/logo.png",
          // The respondent typed this address in, so it is also capped per recipient (ENG-3823).
          rateLimit: { organizationId: "org1", actorUserId: "owner-1", externalRecipient: true },
        });
      }
    });

    test("should return error when response is not found", async () => {
      vi.mocked(getResponse).mockResolvedValue(null);

      const result = await sendFollowUpsForResponse("nonexistentresponse");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          code: FollowUpSendError.RESPONSE_NOT_FOUND,
          message: "Response not found",
          meta: { responseId: "nonexistentresponse" },
        });
      }
    });

    test("should return error when survey is not found", async () => {
      vi.mocked(getSurvey).mockResolvedValue(null);

      const result = await sendFollowUpsForResponse("response1");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          code: FollowUpSendError.SURVEY_NOT_FOUND,
          message: "Survey not found",
          meta: { responseId: "response1", surveyId: "survey1" },
        });
      }
    });

    test("should return error when organization is not found", async () => {
      vi.mocked(getOrganizationByWorkspaceId).mockResolvedValue(null);

      const result = await sendFollowUpsForResponse("response1");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          code: FollowUpSendError.ORG_NOT_FOUND,
          message: "Organization not found",
          meta: { responseId: "response1", surveyId: "survey1", workspaceId: "ws1" },
        });
      }
    });

    test("should return error when follow-ups are not allowed", async () => {
      vi.mocked(getSurveyFollowUpsPermission).mockResolvedValue(false);

      const result = await sendFollowUpsForResponse("response1");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          code: FollowUpSendError.FOLLOW_UP_NOT_ALLOWED,
          message: "Survey follow-ups are not allowed for this organization",
          meta: { responseId: "response1", surveyId: "survey1", organizationId: "org1" },
        });
      }
    });

    test("should skip follow-up when ending ID doesn't match", async () => {
      const modifiedResponse = {
        ...mockResponse,
        endingId: "different-ending",
      };

      vi.mocked(getResponse).mockResolvedValue(modifiedResponse);

      const result = await sendFollowUpsForResponse("response1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toEqual({
          followUpId: "followup1",
          status: "skipped",
        });

        expect(sendFollowUpEmail).not.toHaveBeenCalled();
      }
    });

    test("should handle direct email address in follow-up", async () => {
      const modifiedSurvey = {
        ...mockSurvey,
        followUps: [
          {
            ...mockSurvey.followUps[0],
            action: {
              ...mockSurvey.followUps[0].action,
              properties: {
                ...mockSurvey.followUps[0].action.properties,
                to: "direct@example.com",
              },
            },
          },
        ],
      };

      vi.mocked(getSurvey).mockResolvedValue(modifiedSurvey);

      const result = await sendFollowUpsForResponse("response1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toEqual({
          followUpId: "followup1",
          status: "success",
        });

        expect(sendFollowUpEmail).toHaveBeenCalledWith({
          followUp: modifiedSurvey.followUps[0],
          to: "direct@example.com",
          replyTo: "noreply@example.com",
          survey: modifiedSurvey,
          response: mockResponse,
          attachResponseData: true,
          logoUrl: "https://example.com/logo.png",
          // A member of the organization: its own mail, not counted against the external budget.
          rateLimit: { organizationId: "org1", actorUserId: "owner-1", externalRecipient: false },
        });
      }
    });

    test("should handle invalid email address in response data", async () => {
      const modifiedResponse = {
        ...mockResponse,
        data: {
          email: "invalid-email",
        },
      };

      vi.mocked(getResponse).mockResolvedValue(modifiedResponse);

      const result = await sendFollowUpsForResponse("response1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toEqual({
          followUpId: "followup1",
          status: "error",
          error: "Email address is not valid for followup: followup1",
        });
        expect(sendFollowUpEmail).not.toHaveBeenCalled();
      }
    });

    test("should handle missing email value in response data", async () => {
      const modifiedResponse = {
        ...mockResponse,
        data: {},
      };

      vi.mocked(getSurvey).mockResolvedValue({
        ...mockSurvey,
        followUps: [
          {
            id: "followup1",
            action: {
              type: "email",
              properties: {
                to: "email",
                replyTo: "noreply@example.com",
                attachResponseData: true,
              },
            },
            trigger: {
              type: "response",
              properties: {
                endingIds: ["ending1"],
              },
            },
          },
        ],
      } as unknown as TSurvey);

      vi.mocked(getResponse).mockResolvedValue(modifiedResponse as unknown as any);

      const result = await sendFollowUpsForResponse("response1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toEqual({
          followUpId: "followup1",
          status: "error",
          error: "To value not found in response data for followup: followup1",
        });
        expect(sendFollowUpEmail).not.toHaveBeenCalled();
      }
    });

    // The author can type any address, so one outside the organization is counted like a respondent's.
    test("counts a literal follow-up address outside the organization as external", async () => {
      vi.mocked(getSurvey).mockResolvedValue({
        ...mockSurvey,
        followUps: [
          {
            ...mockSurvey.followUps[0],
            action: {
              ...mockSurvey.followUps[0].action,
              properties: { ...mockSurvey.followUps[0].action.properties, to: "stranger@example.com" },
            },
          },
        ],
      } as unknown as TSurvey);

      await sendFollowUpsForResponse("response1");

      expect(sendFollowUpEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "stranger@example.com",
          rateLimit: { organizationId: "org1", actorUserId: "owner-1", externalRecipient: true },
        })
      );
    });

    // A survey created with an API key has no owner; its organization's owner is charged instead.
    test("charges the organization's owner for a survey without an owner", async () => {
      vi.mocked(getSurvey).mockResolvedValue({ ...mockSurvey, ownerId: null } as unknown as TSurvey);

      await sendFollowUpsForResponse("response1");

      expect(sendFollowUpEmail).toHaveBeenCalledWith(
        expect.objectContaining({ rateLimit: expect.objectContaining({ actorUserId: "org-owner" }) })
      );
    });

    test("should handle email sending error", async () => {
      vi.mocked(getSurvey).mockResolvedValue({
        ...mockSurvey,
        followUps: [
          {
            id: "followup1",
            action: {
              type: "email",
              properties: {
                to: "hello@example.com",
                replyTo: "noreply@example.com",
                attachResponseData: true,
              },
            },
            trigger: {
              type: "response",
              properties: {
                endingIds: ["ending1"],
              },
            },
          },
        ],
      } as unknown as TSurvey);

      vi.mocked(sendFollowUpEmail).mockRejectedValue(new Error("Failed to send email"));

      const result = await sendFollowUpsForResponse("response1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toEqual({
          followUpId: "followup1",
          status: "error",
          error: "Failed to send email",
        });
      }
    });

    test("should return empty array when no follow-ups are configured", async () => {
      const modifiedSurvey = {
        ...mockSurvey,
        followUps: [],
      } as unknown as TSurvey;

      vi.mocked(getSurvey).mockResolvedValue(modifiedSurvey);

      const result = await sendFollowUpsForResponse("response1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual([]);
        expect(sendFollowUpEmail).not.toHaveBeenCalled();
      }
    });
  });
});
