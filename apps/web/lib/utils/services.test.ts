import {
  ActionClass,
  ApiKey,
  Contact,
  Integration,
  Invite,
  Language,
  Prisma,
  Response,
  Segment,
  Survey,
  Tag,
  Team,
  Webhook,
  Workspace,
} from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurveyQuota } from "@formbricks/types/quota";
import { validateInputs } from "@/lib/utils/validate";
import { getQuota as getQuotaService } from "@/modules/ee/quotas/lib/quotas";
import {
  getActionClass,
  getApiKey,
  getConnector,
  getContact,
  getContactAttributeKey,
  getIntegration,
  getInvite,
  getLanguage,
  getQuota,
  getResponse,
  getSegment,
  getSurvey,
  getTag,
  getTeam,
  getWebhook,
  getWorkspace,
  isTeamPartOfOrganization,
  isWorkspacePartOfOrganization,
} from "./services";

// Mock all dependencies
vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    actionClass: {
      findUnique: vi.fn(),
    },
    apiKey: {
      findUnique: vi.fn(),
    },
    integration: {
      findUnique: vi.fn(),
    },
    invite: {
      findUnique: vi.fn(),
    },
    language: {
      findFirst: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
    },
    response: {
      findUnique: vi.fn(),
    },

    survey: {
      findUnique: vi.fn(),
    },
    tag: {
      findUnique: vi.fn(),
    },
    webhook: {
      findUnique: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
    },
    insight: {
      findUnique: vi.fn(),
    },
    document: {
      findUnique: vi.fn(),
    },
    contact: {
      findUnique: vi.fn(),
    },
    connector: {
      findUnique: vi.fn(),
    },
    segment: {
      findUnique: vi.fn(),
    },
    surveyQuota: {
      findUnique: vi.fn(),
    },
    contactAttributeKey: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/modules/ee/quotas/lib/quotas", () => ({
  getQuota: vi.fn(),
}));

describe("Service Functions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getActionClass", () => {
    const actionClassId = "action123";

    test("returns the action class when found", async () => {
      const mockActionClass = { workspaceId: "ws123" } as unknown as ActionClass;
      vi.mocked(prisma.actionClass.findUnique).mockResolvedValue(mockActionClass);

      const result = await getActionClass(actionClassId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.actionClass.findUnique).toHaveBeenCalledWith({
        where: { id: actionClassId },
        select: { workspaceId: true },
      });
      expect(result).toEqual(mockActionClass);
    });

    test("throws DatabaseError when database operation fails", async () => {
      vi.mocked(prisma.actionClass.findUnique).mockRejectedValue(new Error("Database error"));

      await expect(getActionClass(actionClassId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getApiKey", () => {
    const apiKeyId = "apiKey123";

    test("returns the api key when found", async () => {
      const mockApiKey = { organizationId: "org123" } as unknown as ApiKey;
      vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(mockApiKey);

      const result = await getApiKey(apiKeyId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({
        where: { id: apiKeyId },
        select: { organizationId: true },
      });
      expect(result).toEqual(mockApiKey);
    });

    test("throws InvalidInputError if apiKeyId is empty", async () => {
      await expect(getApiKey("")).rejects.toThrow(InvalidInputError);
      expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
    });

    test("throws DatabaseError when database operation fails", async () => {
      vi.mocked(prisma.apiKey.findUnique).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Error", {
          code: "P2002",
          clientVersion: "4.7.0",
        })
      );

      await expect(getApiKey(apiKeyId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getIntegration", () => {
    const integrationId = "int123";

    test("returns the integration when found", async () => {
      const mockIntegration = { workspaceId: "ws123" } as unknown as Integration;
      vi.mocked(prisma.integration.findUnique).mockResolvedValue(mockIntegration);

      const result = await getIntegration(integrationId);
      expect(prisma.integration.findUnique).toHaveBeenCalledWith({
        where: { id: integrationId },
        select: { workspaceId: true },
      });
      expect(result).toEqual(mockIntegration);
    });

    test("throws DatabaseError when database operation fails", async () => {
      vi.mocked(prisma.integration.findUnique).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Error", {
          code: "P2002",
          clientVersion: "4.7.0",
        })
      );

      await expect(getIntegration(integrationId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getInvite", () => {
    const inviteId = "invite123";

    test("returns the invite when found", async () => {
      const mockInvite = { organizationId: "org123" } as unknown as Invite;
      vi.mocked(prisma.invite.findUnique).mockResolvedValue(mockInvite);

      const result = await getInvite(inviteId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.invite.findUnique).toHaveBeenCalledWith({
        where: { id: inviteId },
        select: { organizationId: true },
      });
      expect(result).toEqual(mockInvite);
    });

    test("throws DatabaseError when database operation fails", async () => {
      vi.mocked(prisma.invite.findUnique).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Error", {
          code: "P2002",
          clientVersion: "4.7.0",
        })
      );

      await expect(getInvite(inviteId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getLanguage", () => {
    const languageId = "lang123";

    test("returns the language when found", async () => {
      const mockLanguage = { workspaceId: "proj123" } as unknown as Language;
      vi.mocked(prisma.language.findFirst).mockResolvedValue(mockLanguage);

      const result = await getLanguage(languageId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.language.findFirst).toHaveBeenCalledWith({
        where: { id: languageId },
        select: { workspaceId: true },
      });
      expect(result).toEqual(mockLanguage);
    });

    test("throws ResourceNotFoundError when language not found", async () => {
      vi.mocked(prisma.language.findFirst).mockResolvedValue(null);

      await expect(getLanguage(languageId)).rejects.toThrow(ResourceNotFoundError);
    });

    test("throws DatabaseError when database operation fails", async () => {
      vi.mocked(prisma.language.findFirst).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Error", {
          code: "P2002",
          clientVersion: "4.7.0",
        })
      );

      await expect(getLanguage(languageId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getWorkspace", () => {
    const workspaceId = "proj123";

    test("returns the workspace when found", async () => {
      const mockWorkspace = { organizationId: "org123" } as unknown as Workspace;
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(mockWorkspace);

      const result = await getWorkspace(workspaceId);
      expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: workspaceId },
        select: { organizationId: true },
      });
      expect(result).toEqual(mockWorkspace);
    });

    test("falls back to legacyEnvironmentId when primary lookup returns null", async () => {
      const mockWorkspace = { organizationId: "org123" } as unknown as Workspace;
      vi.mocked(prisma.workspace.findUnique)
        .mockResolvedValueOnce(null) // primary lookup
        .mockResolvedValueOnce(mockWorkspace); // legacy lookup

      const result = await getWorkspace("env-old-123");
      expect(prisma.workspace.findUnique).toHaveBeenCalledTimes(2);
      expect(prisma.workspace.findUnique).toHaveBeenNthCalledWith(2, {
        where: { legacyEnvironmentId: "env-old-123" },
        select: { organizationId: true },
      });
      expect(result).toEqual(mockWorkspace);
    });

    test("throws DatabaseError when database operation fails", async () => {
      vi.mocked(prisma.workspace.findUnique).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Error", {
          code: "P2002",
          clientVersion: "4.7.0",
        })
      );

      await expect(getWorkspace(workspaceId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getResponse", () => {
    const responseId = "resp123";

    test("returns the response when found", async () => {
      const mockResponse = { surveyId: "survey123" } as unknown as Response;
      vi.mocked(prisma.response.findUnique).mockResolvedValue(mockResponse);

      const result = await getResponse(responseId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.response.findUnique).toHaveBeenCalledWith({
        where: { id: responseId },
        select: { surveyId: true },
      });
      expect(result).toEqual(mockResponse);
    });

    test("throws DatabaseError when database operation fails", async () => {
      vi.mocked(prisma.response.findUnique).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Error", {
          code: "P2002",
          clientVersion: "4.7.0",
        })
      );

      await expect(getResponse(responseId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getSurvey", () => {
    const surveyId = "survey123";

    test("returns the survey when found", async () => {
      const mockSurvey = { workspaceId: "ws123" } as unknown as Survey;
      vi.mocked(prisma.survey.findUnique).mockResolvedValue(mockSurvey);

      const result = await getSurvey(surveyId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.survey.findUnique).toHaveBeenCalledWith({
        where: { id: surveyId },
        select: { workspaceId: true },
      });
      expect(result).toEqual(mockSurvey);
    });

    test("throws DatabaseError when database operation fails", async () => {
      vi.mocked(prisma.survey.findUnique).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Error", {
          code: "P2002",
          clientVersion: "4.7.0",
        })
      );

      await expect(getSurvey(surveyId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getTag", () => {
    const tagId = "tag123";

    test("returns the tag when found", async () => {
      const mockTag = { workspaceId: "ws123" } as unknown as Tag;
      vi.mocked(prisma.tag.findUnique).mockResolvedValue(mockTag);

      const result = await getTag(tagId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.tag.findUnique).toHaveBeenCalledWith({
        where: { id: tagId },
        select: { workspaceId: true },
      });
      expect(result).toEqual(mockTag);
    });
  });

  describe("getWebhook", () => {
    const webhookId = "webhook123";

    test("returns the webhook when found", async () => {
      const mockWebhook = { workspaceId: "ws123" } as unknown as Webhook;
      vi.mocked(prisma.webhook.findUnique).mockResolvedValue(mockWebhook);

      const result = await getWebhook(webhookId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.webhook.findUnique).toHaveBeenCalledWith({
        where: { id: webhookId },
        select: { workspaceId: true },
      });
      expect(result).toEqual(mockWebhook);
    });

    test("throws DatabaseError when database operation fails", async () => {
      vi.mocked(prisma.webhook.findUnique).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Error", {
          code: "P2002",
          clientVersion: "4.7.0",
        })
      );

      await expect(getWebhook(webhookId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getQuota", () => {
    const quotaId = "quota123";

    test("returns surveyId when found (delegates to getQuotaService)", async () => {
      const mockQuota = { surveyId: "survey123" } as TSurveyQuota;
      vi.mocked(getQuotaService).mockResolvedValue(mockQuota);

      const result = await getQuota(quotaId);
      expect(validateInputs).toHaveBeenCalled();
      expect(getQuotaService).toHaveBeenCalledWith(quotaId);
      expect(result).toEqual(mockQuota);
    });

    test("throws DatabaseError when underlying service fails", async () => {
      vi.mocked(getQuotaService).mockRejectedValue(new DatabaseError("error"));
      await expect(getQuota(quotaId)).rejects.toThrow(DatabaseError);
    });

    test("throws ResourceNotFoundError when quota not found", async () => {
      vi.mocked(getQuotaService).mockRejectedValue(new ResourceNotFoundError("Quota", quotaId));
      await expect(getQuota(quotaId)).rejects.toThrow(ResourceNotFoundError);
    });
  });

  describe("getTeam", () => {
    const teamId = "team123";

    test("returns the team when found", async () => {
      const mockTeam = { organizationId: "org123" } as unknown as Team;
      vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam);

      const result = await getTeam(teamId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.team.findUnique).toHaveBeenCalledWith({
        where: { id: teamId },
        select: { organizationId: true },
      });
      expect(result).toEqual(mockTeam);
    });

    test("throws DatabaseError when database operation fails", async () => {
      vi.mocked(prisma.team.findUnique).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Error", {
          code: "P2002",
          clientVersion: "4.7.0",
        })
      );

      await expect(getTeam(teamId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("isWorkspacePartOfOrganization", () => {
    const workspaceId = "proj123";
    const organizationId = "org123";

    test("returns true when workspace belongs to organization", async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue({ organizationId } as unknown as Workspace);

      const result = await isWorkspacePartOfOrganization(organizationId, workspaceId);
      expect(result).toBe(true);
    });

    test("returns false when workspace belongs to different organization", async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
        organizationId: "otherOrg",
      } as unknown as Workspace);

      const result = await isWorkspacePartOfOrganization(organizationId, workspaceId);
      expect(result).toBe(false);
    });

    test("throws ResourceNotFoundError when workspace not found", async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

      await expect(isWorkspacePartOfOrganization(organizationId, workspaceId)).rejects.toThrow(
        ResourceNotFoundError
      );
    });
  });

  describe("isTeamPartOfOrganization", () => {
    const teamId = "team123";
    const organizationId = "org123";

    test("returns true when team belongs to organization", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ organizationId } as unknown as Team);

      const result = await isTeamPartOfOrganization(organizationId, teamId);
      expect(result).toBe(true);
    });

    test("returns false when team belongs to different organization", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ organizationId: "otherOrg" } as unknown as Team);

      const result = await isTeamPartOfOrganization(organizationId, teamId);
      expect(result).toBe(false);
    });

    test("throws ResourceNotFoundError when team not found", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      await expect(isTeamPartOfOrganization(organizationId, teamId)).rejects.toThrow(ResourceNotFoundError);
    });
  });

  describe("getContact", () => {
    const contactId = "contact123";

    test("returns the contact when found", async () => {
      const mockContact = { workspaceId: "ws123" } as unknown as Contact;
      vi.mocked(prisma.contact.findUnique).mockResolvedValue(mockContact);

      const result = await getContact(contactId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.contact.findUnique).toHaveBeenCalledWith({
        where: { id: contactId },
        select: { workspaceId: true },
      });
      expect(result).toEqual(mockContact);
    });

    test("throws DatabaseError when database operation fails", async () => {
      vi.mocked(prisma.contact.findUnique).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Error", {
          code: "P2002",
          clientVersion: "4.7.0",
        })
      );

      await expect(getContact(contactId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getSegment", () => {
    const segmentId = "segment123";

    test("returns the segment when found", async () => {
      const mockSegment = { workspaceId: "ws123" } as unknown as Segment;
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(mockSegment);

      const result = await getSegment(segmentId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.segment.findUnique).toHaveBeenCalledWith({
        where: { id: segmentId },
        select: { workspaceId: true },
      });
      expect(result).toEqual(mockSegment);
    });

    test("throws DatabaseError when database operation fails", async () => {
      vi.mocked(prisma.segment.findUnique).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Error", {
          code: "P2002",
          clientVersion: "4.7.0",
        })
      );

      await expect(getSegment(segmentId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getConnector", () => {
    const connectorId = "connector123";

    test("returns the connector when found", async () => {
      const mockConnector = { workspaceId: "ws123" };
      vi.mocked(prisma.connector.findUnique).mockResolvedValue(mockConnector);

      const result = await getConnector(connectorId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.connector.findUnique).toHaveBeenCalledWith({
        where: { id: connectorId },
        select: { workspaceId: true },
      });
      expect(result).toEqual(mockConnector);
    });

    test("returns null when connector not found", async () => {
      vi.mocked(prisma.connector.findUnique).mockResolvedValue(null);

      const result = await getConnector(connectorId);
      expect(result).toBeNull();
    });

    test("throws DatabaseError when Prisma throws a known request error", async () => {
      vi.mocked(prisma.connector.findUnique).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Error", {
          code: "P2002",
          clientVersion: "4.7.0",
        })
      );

      await expect(getConnector(connectorId)).rejects.toThrow(DatabaseError);
    });

    test("rethrows unknown errors", async () => {
      const unknownError = new Error("Something unexpected");
      vi.mocked(prisma.connector.findUnique).mockRejectedValue(unknownError);

      await expect(getConnector(connectorId)).rejects.toThrow(unknownError);
    });
  });

  describe("getContactAttributeKey", () => {
    const contactAttributeKeyId = "attrKey123";

    test("returns the contact attribute key when found", async () => {
      const mockAttributeKey = { workspaceId: "ws123" };
      vi.mocked(prisma.contactAttributeKey.findUnique).mockResolvedValue(mockAttributeKey);

      const result = await getContactAttributeKey(contactAttributeKeyId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.contactAttributeKey.findUnique).toHaveBeenCalledWith({
        where: { id: contactAttributeKeyId },
        select: { workspaceId: true },
      });
      expect(result).toEqual(mockAttributeKey);
    });

    test("returns null when contact attribute key not found", async () => {
      vi.mocked(prisma.contactAttributeKey.findUnique).mockResolvedValue(null);

      const result = await getContactAttributeKey(contactAttributeKeyId);
      expect(result).toBeNull();
    });

    test("throws DatabaseError when Prisma throws a known request error", async () => {
      vi.mocked(prisma.contactAttributeKey.findUnique).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Error", {
          code: "P2002",
          clientVersion: "4.7.0",
        })
      );

      await expect(getContactAttributeKey(contactAttributeKeyId)).rejects.toThrow(DatabaseError);
    });

    test("rethrows unknown errors", async () => {
      const unknownError = new Error("Something unexpected");
      vi.mocked(prisma.contactAttributeKey.findUnique).mockRejectedValue(unknownError);

      await expect(getContactAttributeKey(contactAttributeKeyId)).rejects.toThrow(unknownError);
    });
  });
});
