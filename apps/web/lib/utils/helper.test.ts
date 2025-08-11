import * as services from "@/lib/utils/services";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import {
  getEnvironmentIdFromInsightId,
  getEnvironmentIdFromResponseId,
  getEnvironmentIdFromSegmentId,
  getEnvironmentIdFromSurveyId,
  getEnvironmentIdFromTagId,
  getFormattedErrorMessage,
  getOrganizationIdFromActionClassId,
  getOrganizationIdFromApiKeyId,
  getOrganizationIdFromContactId,
  getOrganizationIdFromDocumentId,
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromInsightId,
  getOrganizationIdFromIntegrationId,
  getOrganizationIdFromInviteId,
  getOrganizationIdFromLanguageId,
  getOrganizationIdFromProjectId,
  getOrganizationIdFromResponseId,
  getOrganizationIdFromSegmentId,
  getOrganizationIdFromSurveyId,
  getOrganizationIdFromTagId,
  getOrganizationIdFromTeamId,
  getOrganizationIdFromWebhookId,
  getProductIdFromContactId,
  getProjectIdFromActionClassId,
  getProjectIdFromContactId,
  getProjectIdFromDocumentId,
  getProjectIdFromEnvironmentId,
  getProjectIdFromInsightId,
  getProjectIdFromIntegrationId,
  getProjectIdFromLanguageId,
  getProjectIdFromResponseId,
  getProjectIdFromSegmentId,
  getProjectIdFromSurveyId,
  getProjectIdFromTagId,
  getProjectIdFromWebhookId,
  isStringMatch,
} from "./helper";

// Mock all service functions
vi.mock("@/lib/utils/services", () => ({
  getProject: vi.fn(),
  getEnvironment: vi.fn(),
  getSurvey: vi.fn(),
  getResponse: vi.fn(),
  getContact: vi.fn(),

  getSegment: vi.fn(),
  getActionClass: vi.fn(),
  getIntegration: vi.fn(),
  getWebhook: vi.fn(),
  getApiKey: vi.fn(),
  getInvite: vi.fn(),
  getLanguage: vi.fn(),
  getTeam: vi.fn(),
  getInsight: vi.fn(),
  getDocument: vi.fn(),
  getTag: vi.fn(),
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
        },
      };
      expect(getFormattedErrorMessage(result)).toBe("nameName is required\nemailEmail is invalid");
    });

    test("returns empty string for undefined errors", () => {
      const result = { validationErrors: undefined };
      expect(getFormattedErrorMessage(result)).toBe("");
    });
  });

  describe("Organization ID retrieval functions", () => {
    test("getOrganizationIdFromProjectId returns organization ID when project exists", async () => {
      vi.mocked(services.getProject).mockResolvedValueOnce({
        organizationId: "org1",
      });

      const orgId = await getOrganizationIdFromProjectId("project1");
      expect(orgId).toBe("org1");
      expect(services.getProject).toHaveBeenCalledWith("project1");
    });

    test("getOrganizationIdFromProjectId throws error when project not found", async () => {
      vi.mocked(services.getProject).mockResolvedValueOnce(null);

      await expect(getOrganizationIdFromProjectId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
      expect(services.getProject).toHaveBeenCalledWith("nonexistent");
    });

    test("getOrganizationIdFromEnvironmentId returns organization ID through project", async () => {
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });
      vi.mocked(services.getProject).mockResolvedValueOnce({
        organizationId: "org1",
      });

      const orgId = await getOrganizationIdFromEnvironmentId("env1");
      expect(orgId).toBe("org1");
      expect(services.getEnvironment).toHaveBeenCalledWith("env1");
      expect(services.getProject).toHaveBeenCalledWith("project1");
    });

    test("getOrganizationIdFromEnvironmentId throws error when environment not found", async () => {
      vi.mocked(services.getEnvironment).mockResolvedValueOnce(null);

      await expect(getOrganizationIdFromEnvironmentId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getOrganizationIdFromSurveyId returns organization ID through environment and project", async () => {
      vi.mocked(services.getSurvey).mockResolvedValueOnce({
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });
      vi.mocked(services.getProject).mockResolvedValueOnce({
        organizationId: "org1",
      });

      const orgId = await getOrganizationIdFromSurveyId("survey1");
      expect(orgId).toBe("org1");
      expect(services.getSurvey).toHaveBeenCalledWith("survey1");
      expect(services.getEnvironment).toHaveBeenCalledWith("env1");
      expect(services.getProject).toHaveBeenCalledWith("project1");
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
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });
      vi.mocked(services.getProject).mockResolvedValueOnce({
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
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });
      vi.mocked(services.getProject).mockResolvedValueOnce({
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
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });
      vi.mocked(services.getProject).mockResolvedValueOnce({
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
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });
      vi.mocked(services.getProject).mockResolvedValueOnce({
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
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });
      vi.mocked(services.getProject).mockResolvedValueOnce({
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
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });
      vi.mocked(services.getProject).mockResolvedValueOnce({
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
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });
      vi.mocked(services.getProject).mockResolvedValueOnce({
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
        projectId: "project1",
      });
      vi.mocked(services.getProject).mockResolvedValueOnce({
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

    test("getOrganizationIdFromInsightId returns organization ID correctly", async () => {
      vi.mocked(services.getInsight).mockResolvedValueOnce({
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });
      vi.mocked(services.getProject).mockResolvedValueOnce({
        organizationId: "org1",
      });

      const orgId = await getOrganizationIdFromInsightId("insight1");
      expect(orgId).toBe("org1");
    });

    test("getOrganizationIdFromInsightId throws error when insight not found", async () => {
      vi.mocked(services.getInsight).mockResolvedValueOnce(null);
      await expect(getOrganizationIdFromInsightId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getOrganizationIdFromDocumentId returns organization ID correctly", async () => {
      vi.mocked(services.getDocument).mockResolvedValueOnce({
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });
      vi.mocked(services.getProject).mockResolvedValueOnce({
        organizationId: "org1",
      });

      const orgId = await getOrganizationIdFromDocumentId("doc1");
      expect(orgId).toBe("org1");
    });

    test("getOrganizationIdFromDocumentId throws error when document not found", async () => {
      vi.mocked(services.getDocument).mockResolvedValueOnce(null);
      await expect(getOrganizationIdFromDocumentId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });
  });

  describe("Project ID retrieval functions", () => {
    test("getProjectIdFromEnvironmentId returns project ID directly", async () => {
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });

      const projectId = await getProjectIdFromEnvironmentId("env1");
      expect(projectId).toBe("project1");
      expect(services.getEnvironment).toHaveBeenCalledWith("env1");
    });

    test("getProjectIdFromEnvironmentId throws error when environment not found", async () => {
      vi.mocked(services.getEnvironment).mockResolvedValueOnce(null);

      await expect(getProjectIdFromEnvironmentId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getProjectIdFromSurveyId returns project ID through environment", async () => {
      vi.mocked(services.getSurvey).mockResolvedValueOnce({
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });

      const projectId = await getProjectIdFromSurveyId("survey1");
      expect(projectId).toBe("project1");
      expect(services.getSurvey).toHaveBeenCalledWith("survey1");
      expect(services.getEnvironment).toHaveBeenCalledWith("env1");
    });

    test("getProjectIdFromSurveyId throws error when survey not found", async () => {
      vi.mocked(services.getSurvey).mockResolvedValueOnce(null);
      await expect(getProjectIdFromSurveyId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getProjectIdFromContactId returns project ID correctly", async () => {
      vi.mocked(services.getContact).mockResolvedValueOnce({
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });

      const projectId = await getProjectIdFromContactId("contact1");
      expect(projectId).toBe("project1");
    });

    test("getProjectIdFromContactId throws error when contact not found", async () => {
      vi.mocked(services.getContact).mockResolvedValueOnce(null);
      await expect(getProjectIdFromContactId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getProjectIdFromInsightId returns project ID correctly", async () => {
      vi.mocked(services.getInsight).mockResolvedValueOnce({
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });

      const projectId = await getProjectIdFromInsightId("insight1");
      expect(projectId).toBe("project1");
    });

    test("getProjectIdFromInsightId throws error when insight not found", async () => {
      vi.mocked(services.getInsight).mockResolvedValueOnce(null);
      await expect(getProjectIdFromInsightId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getProjectIdFromSegmentId returns project ID correctly", async () => {
      vi.mocked(services.getSegment).mockResolvedValueOnce({
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });

      const projectId = await getProjectIdFromSegmentId("segment1");
      expect(projectId).toBe("project1");
    });

    test("getProjectIdFromSegmentId throws error when segment not found", async () => {
      vi.mocked(services.getSegment).mockResolvedValueOnce(null);
      await expect(getProjectIdFromSegmentId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getProjectIdFromActionClassId returns project ID correctly", async () => {
      vi.mocked(services.getActionClass).mockResolvedValueOnce({
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });

      const projectId = await getProjectIdFromActionClassId("action1");
      expect(projectId).toBe("project1");
    });

    test("getProjectIdFromActionClassId throws error when actionClass not found", async () => {
      vi.mocked(services.getActionClass).mockResolvedValueOnce(null);
      await expect(getProjectIdFromActionClassId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getProjectIdFromTagId returns project ID correctly", async () => {
      vi.mocked(services.getTag).mockResolvedValueOnce({
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });

      const projectId = await getProjectIdFromTagId("tag1");
      expect(projectId).toBe("project1");
    });

    test("getProjectIdFromTagId throws error when tag not found", async () => {
      vi.mocked(services.getTag).mockResolvedValueOnce(null);
      await expect(getProjectIdFromTagId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getProjectIdFromLanguageId returns project ID directly", async () => {
      vi.mocked(services.getLanguage).mockResolvedValueOnce({
        projectId: "project1",
      });

      const projectId = await getProjectIdFromLanguageId("lang1");
      expect(projectId).toBe("project1");
    });

    test("getProjectIdFromLanguageId throws error when language not found", async () => {
      vi.mocked(services.getLanguage).mockResolvedValueOnce(undefined as unknown as any);
      await expect(getProjectIdFromLanguageId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getProjectIdFromResponseId returns project ID correctly", async () => {
      vi.mocked(services.getResponse).mockResolvedValueOnce({
        surveyId: "survey1",
      });
      vi.mocked(services.getSurvey).mockResolvedValueOnce({
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });

      const projectId = await getProjectIdFromResponseId("response1");
      expect(projectId).toBe("project1");
    });

    test("getProjectIdFromResponseId throws error when response not found", async () => {
      vi.mocked(services.getResponse).mockResolvedValueOnce(null);
      await expect(getProjectIdFromResponseId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getProductIdFromContactId returns project ID correctly", async () => {
      vi.mocked(services.getContact).mockResolvedValueOnce({
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });

      const projectId = await getProductIdFromContactId("contact1");
      expect(projectId).toBe("project1");
    });

    test("getProductIdFromContactId throws error when contact not found", async () => {
      vi.mocked(services.getContact).mockResolvedValueOnce(null);
      await expect(getProductIdFromContactId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getProjectIdFromDocumentId returns project ID correctly", async () => {
      vi.mocked(services.getDocument).mockResolvedValueOnce({
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });

      const projectId = await getProjectIdFromDocumentId("doc1");
      expect(projectId).toBe("project1");
    });

    test("getProjectIdFromDocumentId throws error when document not found", async () => {
      vi.mocked(services.getDocument).mockResolvedValueOnce(null);
      await expect(getProjectIdFromDocumentId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getProjectIdFromIntegrationId returns project ID correctly", async () => {
      vi.mocked(services.getIntegration).mockResolvedValueOnce({
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });

      const projectId = await getProjectIdFromIntegrationId("integration1");
      expect(projectId).toBe("project1");
    });

    test("getProjectIdFromIntegrationId throws error when integration not found", async () => {
      vi.mocked(services.getIntegration).mockResolvedValueOnce(null);
      await expect(getProjectIdFromIntegrationId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getProjectIdFromWebhookId returns project ID correctly", async () => {
      vi.mocked(services.getWebhook).mockResolvedValueOnce({
        environmentId: "env1",
      });
      vi.mocked(services.getEnvironment).mockResolvedValueOnce({
        projectId: "project1",
      });

      const projectId = await getProjectIdFromWebhookId("webhook1");
      expect(projectId).toBe("project1");
    });

    test("getProjectIdFromWebhookId throws error when webhook not found", async () => {
      vi.mocked(services.getWebhook).mockResolvedValueOnce(null);
      await expect(getProjectIdFromWebhookId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });
  });

  describe("Environment ID retrieval functions", () => {
    test("getEnvironmentIdFromSurveyId returns environment ID directly", async () => {
      vi.mocked(services.getSurvey).mockResolvedValueOnce({
        environmentId: "env1",
      });

      const environmentId = await getEnvironmentIdFromSurveyId("survey1");
      expect(environmentId).toBe("env1");
    });

    test("getEnvironmentIdFromSurveyId throws error when survey not found", async () => {
      vi.mocked(services.getSurvey).mockResolvedValueOnce(null);
      await expect(getEnvironmentIdFromSurveyId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getEnvironmentIdFromResponseId returns environment ID correctly", async () => {
      vi.mocked(services.getResponse).mockResolvedValueOnce({
        surveyId: "survey1",
      });
      vi.mocked(services.getSurvey).mockResolvedValueOnce({
        environmentId: "env1",
      });

      const environmentId = await getEnvironmentIdFromResponseId("response1");
      expect(environmentId).toBe("env1");
    });

    test("getEnvironmentIdFromResponseId throws error when response not found", async () => {
      vi.mocked(services.getResponse).mockResolvedValueOnce(null);
      await expect(getEnvironmentIdFromResponseId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getEnvironmentIdFromInsightId returns environment ID directly", async () => {
      vi.mocked(services.getInsight).mockResolvedValueOnce({
        environmentId: "env1",
      });

      const environmentId = await getEnvironmentIdFromInsightId("insight1");
      expect(environmentId).toBe("env1");
    });

    test("getEnvironmentIdFromInsightId throws error when insight not found", async () => {
      vi.mocked(services.getInsight).mockResolvedValueOnce(null);
      await expect(getEnvironmentIdFromInsightId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getEnvironmentIdFromSegmentId returns environment ID directly", async () => {
      vi.mocked(services.getSegment).mockResolvedValueOnce({
        environmentId: "env1",
      });

      const environmentId = await getEnvironmentIdFromSegmentId("segment1");
      expect(environmentId).toBe("env1");
    });

    test("getEnvironmentIdFromSegmentId throws error when segment not found", async () => {
      vi.mocked(services.getSegment).mockResolvedValueOnce(null);
      await expect(getEnvironmentIdFromSegmentId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("getEnvironmentIdFromTagId returns environment ID directly", async () => {
      vi.mocked(services.getTag).mockResolvedValueOnce({
        environmentId: "env1",
      });

      const environmentId = await getEnvironmentIdFromTagId("tag1");
      expect(environmentId).toBe("env1");
    });

    test("getEnvironmentIdFromTagId throws error when tag not found", async () => {
      vi.mocked(services.getTag).mockResolvedValueOnce(null);
      await expect(getEnvironmentIdFromTagId("nonexistent")).rejects.toThrow(ResourceNotFoundError);
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
