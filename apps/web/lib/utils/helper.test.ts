import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import * as services from "@/lib/utils/services";
import {
  getFormattedErrorMessage,
  getOrganizationIdFromActionClassId,
  getOrganizationIdFromApiKeyId,
  getOrganizationIdFromContactId,
  getOrganizationIdFromFeedbackSourceId,
  getOrganizationIdFromIntegrationId,
  getOrganizationIdFromInviteId,
  getOrganizationIdFromLanguageId,
  getOrganizationIdFromQuotaId,
  getOrganizationIdFromResponseId,
  getOrganizationIdFromSegmentId,
  getOrganizationIdFromSurveyId,
  getOrganizationIdFromTagId,
  getOrganizationIdFromTeamId,
  getOrganizationIdFromWebhookId,
  getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromActionClassId,
  getWorkspaceIdFromContactId,
  getWorkspaceIdFromIntegrationId,
  getWorkspaceIdFromLanguageId,
  getWorkspaceIdFromQuotaId,
  getWorkspaceIdFromResponseId,
  getWorkspaceIdFromSegmentId,
  getWorkspaceIdFromSurveyId,
  getWorkspaceIdFromTagId,
  getWorkspaceIdFromWebhookId,
  isStringMatch,
} from "./helper";

// Mock all service functions
vi.mock("@/lib/utils/services", () => ({
  getWorkspace: vi.fn(),
  getSurvey: vi.fn(),
  getResponse: vi.fn(),
  getContact: vi.fn(),
  getQuota: vi.fn(),
  getSegment: vi.fn(),
  getActionClass: vi.fn(),
  getIntegration: vi.fn(),
  getWebhook: vi.fn(),
  getApiKey: vi.fn(),
  getInvite: vi.fn(),
  getLanguage: vi.fn(),
  getTeam: vi.fn(),
  getTag: vi.fn(),
  getFeedbackSource: vi.fn(),
}));

describe("Helper Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getFormattedErrorMessage", () => {
    test("returns server error when present", () => {
      const result = {
        serverError: "Internal server error occurred",
        validationErrors: {},
      };
      expect(getFormattedErrorMessage(result)).toBe("Internal server error occurred");
    });

    test("formats validation errors correctly with _errors", () => {
      const result = {
        validationErrors: {
          _errors: ["Invalid input", "Missing required field"],
        },
      };
      expect(getFormattedErrorMessage(result)).toBe("Invalid input, Missing required field");
    });

    test("formats validation errors for specific fields", () => {
      const result = {
        validationErrors: {
          name: { _errors: ["Name is required"] },
          email: { _errors: ["Email is invalid"] },
          password: { _errors: ["is too short"] },
        },
      };
      expect(getFormattedErrorMessage(result)).toBe(
        "Name is required\nEmail is invalid\npassword: is too short"
      );
    });

    test("returns empty string for undefined errors", () => {
      const result = { validationErrors: undefined };
      expect(getFormattedErrorMessage(result)).toBe("");
    });
  });

  describe("Organization ID retrieval functions", () => {
    test("getOrganizationIdFromWorkspaceId returns organization ID when workspace exists", async () => {
      vi.mocked(services.getWorkspace).mockResolvedValueOnce({
        organizationId: "org1",
      });

      const orgId = await getOrganizationIdFromWorkspaceId("workspace1");
      expect(orgId).toBe("org1");
      expect(services.getWorkspace).toHaveBeenCalledWith("workspace1");
    });

    test("getOrganizationIdFromWorkspaceId throws error when workspace not found", async () => {
      vi.mocked(services.getWorkspace).mockResolvedValueOnce(null);

      await expect(getOrganizationIdFromWorkspaceId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
      expect(services.getWorkspace).toHaveBeenCalledWith("nonexistent");
    });

    test("getOrganizationIdFromSurveyId returns organization ID through workspace", async () => {
      vi.mocked(services.getSurvey).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });
      vi.mocked(services.getWorkspace).mockResolvedValueOnce({
        organizationId: "org1",
      });

      const orgId = await getOrganizationIdFromSurveyId("survey1");
      expect(orgId).toBe("org1");
      expect(services.getSurvey).toHaveBeenCalledWith("survey1");
      expect(services.getWorkspace).toHaveBeenCalledWith("workspace1");
    });

    test("getOrganizationIdFromSurveyId throws error when survey not found", async () => {
      vi.mocked(services.getSurvey).mockResolvedValueOnce(null);

      await expect(getOrganizationIdFromSurveyId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getOrganizationIdFromResponseId returns organization ID through the response hierarchy", async () => {
      vi.mocked(services.getResponse).mockResolvedValueOnce({
        surveyId: "survey1",
      });
      vi.mocked(services.getSurvey).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });
      vi.mocked(services.getWorkspace).mockResolvedValueOnce({
        organizationId: "org1",
      });

      const orgId = await getOrganizationIdFromResponseId("response1");
      expect(orgId).toBe("org1");
    });

    test("getOrganizationIdFromResponseId throws error when response not found", async () => {
      vi.mocked(services.getResponse).mockResolvedValueOnce(null);

      await expect(getOrganizationIdFromResponseId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getOrganizationIdFromContactId returns organization ID correctly", async () => {
      vi.mocked(services.getContact).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });
      vi.mocked(services.getWorkspace).mockResolvedValueOnce({
        organizationId: "org1",
      });

      const orgId = await getOrganizationIdFromContactId("contact1");
      expect(orgId).toBe("org1");
    });

    test("getOrganizationIdFromContactId throws error when contact not found", async () => {
      vi.mocked(services.getContact).mockResolvedValueOnce(null);

      await expect(getOrganizationIdFromContactId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getOrganizationIdFromTagId returns organization ID correctly", async () => {
      vi.mocked(services.getTag).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });
      vi.mocked(services.getWorkspace).mockResolvedValueOnce({
        organizationId: "org1",
      });

      const orgId = await getOrganizationIdFromTagId("tag1");
      expect(orgId).toBe("org1");
    });

    test("getOrganizationIdFromTagId throws error when tag not found", async () => {
      vi.mocked(services.getTag).mockResolvedValueOnce(null);

      await expect(getOrganizationIdFromTagId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getOrganizationIdFromSegmentId returns organization ID correctly", async () => {
      vi.mocked(services.getSegment).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });
      vi.mocked(services.getWorkspace).mockResolvedValueOnce({
        organizationId: "org1",
      });

      const orgId = await getOrganizationIdFromSegmentId("segment1");
      expect(orgId).toBe("org1");
    });

    test("getOrganizationIdFromSegmentId throws error when segment not found", async () => {
      vi.mocked(services.getSegment).mockResolvedValueOnce(null);
      await expect(getOrganizationIdFromSegmentId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getOrganizationIdFromActionClassId returns organization ID correctly", async () => {
      vi.mocked(services.getActionClass).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });
      vi.mocked(services.getWorkspace).mockResolvedValueOnce({
        organizationId: "org1",
      });

      const orgId = await getOrganizationIdFromActionClassId("action1");
      expect(orgId).toBe("org1");
    });

    test("getOrganizationIdFromActionClassId throws error when actionClass not found", async () => {
      vi.mocked(services.getActionClass).mockResolvedValueOnce(null);
      await expect(getOrganizationIdFromActionClassId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getOrganizationIdFromIntegrationId returns organization ID correctly", async () => {
      vi.mocked(services.getIntegration).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });
      vi.mocked(services.getWorkspace).mockResolvedValueOnce({
        organizationId: "org1",
      });

      const orgId = await getOrganizationIdFromIntegrationId("integration1");
      expect(orgId).toBe("org1");
    });

    test("getOrganizationIdFromIntegrationId throws error when integration not found", async () => {
      vi.mocked(services.getIntegration).mockResolvedValueOnce(null);
      await expect(getOrganizationIdFromIntegrationId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getOrganizationIdFromWebhookId returns organization ID correctly", async () => {
      vi.mocked(services.getWebhook).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });
      vi.mocked(services.getWorkspace).mockResolvedValueOnce({
        organizationId: "org1",
      });

      const orgId = await getOrganizationIdFromWebhookId("webhook1");
      expect(orgId).toBe("org1");
    });

    test("getOrganizationIdFromWebhookId throws error when webhook not found", async () => {
      vi.mocked(services.getWebhook).mockResolvedValueOnce(null);
      await expect(getOrganizationIdFromWebhookId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getOrganizationIdFromApiKeyId returns organization ID directly", async () => {
      vi.mocked(services.getApiKey).mockResolvedValueOnce({
        organizationId: "org1",
      });

      const orgId = await getOrganizationIdFromApiKeyId("apikey1");
      expect(orgId).toBe("org1");
    });

    test("getOrganizationIdFromApiKeyId throws error when apiKey not found", async () => {
      vi.mocked(services.getApiKey).mockResolvedValueOnce(null);
      await expect(getOrganizationIdFromApiKeyId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getOrganizationIdFromInviteId returns organization ID directly", async () => {
      vi.mocked(services.getInvite).mockResolvedValueOnce({
        organizationId: "org1",
      });

      const orgId = await getOrganizationIdFromInviteId("invite1");
      expect(orgId).toBe("org1");
    });

    test("getOrganizationIdFromInviteId throws error when invite not found", async () => {
      vi.mocked(services.getInvite).mockResolvedValueOnce(null);
      await expect(getOrganizationIdFromInviteId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getOrganizationIdFromLanguageId returns organization ID correctly", async () => {
      vi.mocked(services.getLanguage).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });
      vi.mocked(services.getWorkspace).mockResolvedValueOnce({
        organizationId: "org1",
      });

      const orgId = await getOrganizationIdFromLanguageId("lang1");
      expect(orgId).toBe("org1");
    });

    test("getOrganizationIdFromLanguageId throws error when language not found", async () => {
      vi.mocked(services.getLanguage).mockResolvedValueOnce(undefined as unknown as any);
      await expect(getOrganizationIdFromLanguageId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getOrganizationIdFromTeamId returns organization ID directly", async () => {
      vi.mocked(services.getTeam).mockResolvedValueOnce({
        organizationId: "org1",
      });

      const orgId = await getOrganizationIdFromTeamId("team1");
      expect(orgId).toBe("org1");
    });

    test("getOrganizationIdFromTeamId throws error when team not found", async () => {
      vi.mocked(services.getTeam).mockResolvedValueOnce(null);
      await expect(getOrganizationIdFromTeamId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getOrganizationIdFromQuotaId returns organization ID correctly", async () => {
      vi.mocked(services.getQuota).mockResolvedValueOnce({
        surveyId: "survey1",
      });
      vi.mocked(services.getSurvey).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });
      vi.mocked(services.getWorkspace).mockResolvedValueOnce({
        organizationId: "org1",
      });

      const orgId = await getOrganizationIdFromQuotaId("quota1");
      expect(orgId).toBe("org1");
    });

    test("getOrganizationIdFromFeedbackSourceId returns organization ID through workspace", async () => {
      vi.mocked(services.getFeedbackSource).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });
      vi.mocked(services.getWorkspace).mockResolvedValueOnce({
        organizationId: "org1",
      });

      const orgId = await getOrganizationIdFromFeedbackSourceId("feedbackSource1");
      expect(orgId).toBe("org1");
      expect(services.getFeedbackSource).toHaveBeenCalledWith("feedbackSource1");
      expect(services.getWorkspace).toHaveBeenCalledWith("workspace1");
    });

    test("getOrganizationIdFromFeedbackSourceId throws error when feedbackSource not found", async () => {
      vi.mocked(services.getFeedbackSource).mockResolvedValueOnce(null);

      await expect(getOrganizationIdFromFeedbackSourceId("nonexistent")).rejects.toThrow(
        ResourceNotFoundError
      );
      expect(services.getFeedbackSource).toHaveBeenCalledWith("nonexistent");
    });
  });

  describe("Workspace ID retrieval functions", () => {
    test("getWorkspaceIdFromSurveyId returns workspace ID directly", async () => {
      vi.mocked(services.getSurvey).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });

      const workspaceId = await getWorkspaceIdFromSurveyId("survey1");
      expect(workspaceId).toBe("workspace1");
      expect(services.getSurvey).toHaveBeenCalledWith("survey1");
    });

    test("getWorkspaceIdFromSurveyId throws error when survey not found", async () => {
      vi.mocked(services.getSurvey).mockResolvedValueOnce(null);
      await expect(getWorkspaceIdFromSurveyId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getWorkspaceIdFromContactId returns workspace ID correctly", async () => {
      vi.mocked(services.getContact).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });

      const workspaceId = await getWorkspaceIdFromContactId("contact1");
      expect(workspaceId).toBe("workspace1");
    });

    test("getWorkspaceIdFromContactId throws error when contact not found", async () => {
      vi.mocked(services.getContact).mockResolvedValueOnce(null);
      await expect(getWorkspaceIdFromContactId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getWorkspaceIdFromSegmentId returns workspace ID correctly", async () => {
      vi.mocked(services.getSegment).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });

      const workspaceId = await getWorkspaceIdFromSegmentId("segment1");
      expect(workspaceId).toBe("workspace1");
    });

    test("getWorkspaceIdFromSegmentId throws error when segment not found", async () => {
      vi.mocked(services.getSegment).mockResolvedValueOnce(null);
      await expect(getWorkspaceIdFromSegmentId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getWorkspaceIdFromActionClassId returns workspace ID correctly", async () => {
      vi.mocked(services.getActionClass).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });

      const workspaceId = await getWorkspaceIdFromActionClassId("action1");
      expect(workspaceId).toBe("workspace1");
    });

    test("getWorkspaceIdFromActionClassId throws error when actionClass not found", async () => {
      vi.mocked(services.getActionClass).mockResolvedValueOnce(null);
      await expect(getWorkspaceIdFromActionClassId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getWorkspaceIdFromTagId returns workspace ID correctly", async () => {
      vi.mocked(services.getTag).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });

      const workspaceId = await getWorkspaceIdFromTagId("tag1");
      expect(workspaceId).toBe("workspace1");
    });

    test("getWorkspaceIdFromTagId throws error when tag not found", async () => {
      vi.mocked(services.getTag).mockResolvedValueOnce(null);
      await expect(getWorkspaceIdFromTagId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getWorkspaceIdFromLanguageId returns workspace ID directly", async () => {
      vi.mocked(services.getLanguage).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });

      const workspaceId = await getWorkspaceIdFromLanguageId("lang1");
      expect(workspaceId).toBe("workspace1");
    });

    test("getWorkspaceIdFromLanguageId throws error when language not found", async () => {
      vi.mocked(services.getLanguage).mockResolvedValueOnce(undefined as unknown as any);
      await expect(getWorkspaceIdFromLanguageId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getWorkspaceIdFromResponseId returns workspace ID correctly", async () => {
      vi.mocked(services.getResponse).mockResolvedValueOnce({
        surveyId: "survey1",
      });
      vi.mocked(services.getSurvey).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });

      const workspaceId = await getWorkspaceIdFromResponseId("response1");
      expect(workspaceId).toBe("workspace1");
    });

    test("getWorkspaceIdFromResponseId throws error when response not found", async () => {
      vi.mocked(services.getResponse).mockResolvedValueOnce(null);
      await expect(getWorkspaceIdFromResponseId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getWorkspaceIdFromIntegrationId returns workspace ID correctly", async () => {
      vi.mocked(services.getIntegration).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });

      const workspaceId = await getWorkspaceIdFromIntegrationId("integration1");
      expect(workspaceId).toBe("workspace1");
    });

    test("getWorkspaceIdFromIntegrationId throws error when integration not found", async () => {
      vi.mocked(services.getIntegration).mockResolvedValueOnce(null);
      await expect(getWorkspaceIdFromIntegrationId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getWorkspaceIdFromWebhookId returns workspace ID correctly", async () => {
      vi.mocked(services.getWebhook).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });

      const workspaceId = await getWorkspaceIdFromWebhookId("webhook1");
      expect(workspaceId).toBe("workspace1");
    });

    test("getWorkspaceIdFromWebhookId throws error when webhook not found", async () => {
      vi.mocked(services.getWebhook).mockResolvedValueOnce(null);
      await expect(getWorkspaceIdFromWebhookId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getWorkspaceIdFromQuotaId returns workspace ID correctly", async () => {
      vi.mocked(services.getQuota).mockResolvedValueOnce({
        surveyId: "survey1",
      });
      vi.mocked(services.getSurvey).mockResolvedValueOnce({
        workspaceId: "workspace1",
      });

      const workspaceId = await getWorkspaceIdFromQuotaId("quota1");
      expect(workspaceId).toBe("workspace1");
    });
  });

  describe("isStringMatch", () => {
    test("returns true for exact matches", () => {
      expect(isStringMatch("test", "test")).toBe(true);
    });

    test("returns true for case-insensitive matches", () => {
      expect(isStringMatch("TEST", "test")).toBe(true);
      expect(isStringMatch("test", "TEST")).toBe(true);
    });

    test("returns true for matches with spaces", () => {
      expect(isStringMatch("test case", "testcase")).toBe(true);
      expect(isStringMatch("testcase", "test case")).toBe(true);
    });

    test("returns true for matches with underscores", () => {
      expect(isStringMatch("test_case", "testcase")).toBe(true);
      expect(isStringMatch("testcase", "test_case")).toBe(true);
    });

    test("returns true for matches with dashes", () => {
      expect(isStringMatch("test-case", "testcase")).toBe(true);
      expect(isStringMatch("testcase", "test-case")).toBe(true);
    });

    test("returns true for partial matches", () => {
      expect(isStringMatch("test", "testing")).toBe(true);
    });

    test("returns false for non-matches", () => {
      expect(isStringMatch("test", "other")).toBe(false);
    });
  });
});
