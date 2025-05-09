import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  getActionClass,
  getApiKey,
  getContact,
  getDocument,
  getEnvironment,
  getInsight,
  getIntegration,
  getInvite,
  getLanguage,
  getProject,
  getResponse,
  getResponseNote,
  getSegment,
  getSurvey,
  getTag,
  getTeam,
  getWebhook,
  isProjectPartOfOrganization,
  isTeamPartOfOrganization,
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
    environment: {
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
    project: {
      findUnique: vi.fn(),
    },
    response: {
      findUnique: vi.fn(),
    },
    responseNote: {
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
    segment: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock cache
vi.mock("@/lib/cache", () => ({
  cache: vi.fn((fn) => fn),
}));

// Mock react cache
vi.mock("react", () => ({
  cache: vi.fn((fn) => fn),
}));

// Mock all cache modules
vi.mock("@/lib/actionClass/cache", () => ({
  actionClassCache: {
    tag: {
      byId: vi.fn((id) => `actionClass-${id}`),
    },
  },
}));

vi.mock("@/lib/cache/api-key", () => ({
  apiKeyCache: {
    tag: {
      byId: vi.fn((id) => `apiKey-${id}`),
    },
  },
}));

vi.mock("@/lib/environment/cache", () => ({
  environmentCache: {
    tag: {
      byId: vi.fn((id) => `environment-${id}`),
    },
  },
}));

vi.mock("@/lib/integration/cache", () => ({
  integrationCache: {
    tag: {
      byId: vi.fn((id) => `integration-${id}`),
    },
  },
}));

vi.mock("@/lib/cache/invite", () => ({
  inviteCache: {
    tag: {
      byId: vi.fn((id) => `invite-${id}`),
    },
  },
}));

vi.mock("@/lib/project/cache", () => ({
  projectCache: {
    tag: {
      byId: vi.fn((id) => `project-${id}`),
    },
  },
}));

vi.mock("@/lib/response/cache", () => ({
  responseCache: {
    tag: {
      byId: vi.fn((id) => `response-${id}`),
    },
  },
}));

vi.mock("@/lib/responseNote/cache", () => ({
  responseNoteCache: {
    tag: {
      byResponseId: vi.fn((id) => `response-${id}-notes`),
      byId: vi.fn((id) => `responseNote-${id}`),
    },
  },
}));

vi.mock("@/lib/survey/cache", () => ({
  surveyCache: {
    tag: {
      byId: vi.fn((id) => `survey-${id}`),
    },
  },
}));

vi.mock("@/lib/tag/cache", () => ({
  tagCache: {
    tag: {
      byId: vi.fn((id) => `tag-${id}`),
    },
  },
}));

vi.mock("@/lib/cache/webhook", () => ({
  webhookCache: {
    tag: {
      byId: vi.fn((id) => `webhook-${id}`),
    },
  },
}));

vi.mock("@/lib/cache/team", () => ({
  teamCache: {
    tag: {
      byId: vi.fn((id) => `team-${id}`),
    },
  },
}));

vi.mock("@/lib/cache/contact", () => ({
  contactCache: {
    tag: {
      byId: vi.fn((id) => `contact-${id}`),
    },
  },
}));

vi.mock("@/lib/cache/segment", () => ({
  segmentCache: {
    tag: {
      byId: vi.fn((id) => `segment-${id}`),
    },
  },
}));

describe("Service Functions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getActionClass", () => {
    const actionClassId = "action123";

    test("returns the action class when found", async () => {
      const mockActionClass = { environmentId: "env123" };
      vi.mocked(prisma.actionClass.findUnique).mockResolvedValue(mockActionClass);

      const result = await getActionClass(actionClassId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.actionClass.findUnique).toHaveBeenCalledWith({
        where: { id: actionClassId },
        select: { environmentId: true },
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
      const mockApiKey = { organizationId: "org123" };
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

  describe("getEnvironment", () => {
    const environmentId = "env123";

    test("returns the environment when found", async () => {
      const mockEnvironment = { projectId: "proj123" };
      vi.mocked(prisma.environment.findUnique).mockResolvedValue(mockEnvironment);

      const result = await getEnvironment(environmentId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.environment.findUnique).toHaveBeenCalledWith({
        where: { id: environmentId },
        select: { projectId: true },
      });
      expect(result).toEqual(mockEnvironment);
    });

    test("throws DatabaseError when database operation fails", async () => {
      vi.mocked(prisma.environment.findUnique).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Error", {
          code: "P2002",
          clientVersion: "4.7.0",
        })
      );

      await expect(getEnvironment(environmentId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getIntegration", () => {
    const integrationId = "int123";

    test("returns the integration when found", async () => {
      const mockIntegration = { environmentId: "env123" };
      vi.mocked(prisma.integration.findUnique).mockResolvedValue(mockIntegration);

      const result = await getIntegration(integrationId);
      expect(prisma.integration.findUnique).toHaveBeenCalledWith({
        where: { id: integrationId },
        select: { environmentId: true },
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
      const mockInvite = { organizationId: "org123" };
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
      const mockLanguage = { projectId: "proj123" };
      vi.mocked(prisma.language.findFirst).mockResolvedValue(mockLanguage);

      const result = await getLanguage(languageId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.language.findFirst).toHaveBeenCalledWith({
        where: { id: languageId },
        select: { projectId: true },
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

  describe("getProject", () => {
    const projectId = "proj123";

    test("returns the project when found", async () => {
      const mockProject = { organizationId: "org123" };
      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject);

      const result = await getProject(projectId);
      expect(prisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: projectId },
        select: { organizationId: true },
      });
      expect(result).toEqual(mockProject);
    });

    test("throws DatabaseError when database operation fails", async () => {
      vi.mocked(prisma.project.findUnique).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Error", {
          code: "P2002",
          clientVersion: "4.7.0",
        })
      );

      await expect(getProject(projectId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getResponse", () => {
    const responseId = "resp123";

    test("returns the response when found", async () => {
      const mockResponse = { surveyId: "survey123" };
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

  describe("getResponseNote", () => {
    const responseNoteId = "note123";

    test("returns the response note when found", async () => {
      const mockResponseNote = { responseId: "resp123" };
      vi.mocked(prisma.responseNote.findUnique).mockResolvedValue(mockResponseNote);

      const result = await getResponseNote(responseNoteId);
      expect(prisma.responseNote.findUnique).toHaveBeenCalledWith({
        where: { id: responseNoteId },
        select: { responseId: true },
      });
      expect(result).toEqual(mockResponseNote);
    });

    test("throws DatabaseError when database operation fails", async () => {
      vi.mocked(prisma.responseNote.findUnique).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Error", {
          code: "P2002",
          clientVersion: "4.7.0",
        })
      );

      await expect(getResponseNote(responseNoteId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getSurvey", () => {
    const surveyId = "survey123";

    test("returns the survey when found", async () => {
      const mockSurvey = { environmentId: "env123" };
      vi.mocked(prisma.survey.findUnique).mockResolvedValue(mockSurvey);

      const result = await getSurvey(surveyId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.survey.findUnique).toHaveBeenCalledWith({
        where: { id: surveyId },
        select: { environmentId: true },
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
      const mockTag = { environmentId: "env123" };
      vi.mocked(prisma.tag.findUnique).mockResolvedValue(mockTag);

      const result = await getTag(tagId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.tag.findUnique).toHaveBeenCalledWith({
        where: { id: tagId },
        select: { environmentId: true },
      });
      expect(result).toEqual(mockTag);
    });
  });

  describe("getWebhook", () => {
    const webhookId = "webhook123";

    test("returns the webhook when found", async () => {
      const mockWebhook = { environmentId: "env123" };
      vi.mocked(prisma.webhook.findUnique).mockResolvedValue(mockWebhook);

      const result = await getWebhook(webhookId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.webhook.findUnique).toHaveBeenCalledWith({
        where: { id: webhookId },
        select: { environmentId: true },
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

  describe("getTeam", () => {
    const teamId = "team123";

    test("returns the team when found", async () => {
      const mockTeam = { organizationId: "org123" };
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

  describe("getInsight", () => {
    const insightId = "insight123";

    test("returns the insight when found", async () => {
      const mockInsight = { environmentId: "env123" };
      vi.mocked(prisma.insight.findUnique).mockResolvedValue(mockInsight);

      const result = await getInsight(insightId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.insight.findUnique).toHaveBeenCalledWith({
        where: { id: insightId },
        select: { environmentId: true },
      });
      expect(result).toEqual(mockInsight);
    });

    test("throws DatabaseError when database operation fails", async () => {
      vi.mocked(prisma.insight.findUnique).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Error", {
          code: "P2002",
          clientVersion: "4.7.0",
        })
      );

      await expect(getInsight(insightId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getDocument", () => {
    const documentId = "doc123";

    test("returns the document when found", async () => {
      const mockDocument = { environmentId: "env123" };
      vi.mocked(prisma.document.findUnique).mockResolvedValue(mockDocument);

      const result = await getDocument(documentId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.document.findUnique).toHaveBeenCalledWith({
        where: { id: documentId },
        select: { environmentId: true },
      });
      expect(result).toEqual(mockDocument);
    });

    test("throws DatabaseError when database operation fails", async () => {
      vi.mocked(prisma.document.findUnique).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Error", {
          code: "P2002",
          clientVersion: "4.7.0",
        })
      );

      await expect(getDocument(documentId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("isProjectPartOfOrganization", () => {
    const projectId = "proj123";
    const organizationId = "org123";

    test("returns true when project belongs to organization", async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue({ organizationId });

      const result = await isProjectPartOfOrganization(organizationId, projectId);
      expect(result).toBe(true);
    });

    test("returns false when project belongs to different organization", async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue({ organizationId: "otherOrg" });

      const result = await isProjectPartOfOrganization(organizationId, projectId);
      expect(result).toBe(false);
    });

    test("throws ResourceNotFoundError when project not found", async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);

      await expect(isProjectPartOfOrganization(organizationId, projectId)).rejects.toThrow(
        ResourceNotFoundError
      );
    });
  });

  describe("isTeamPartOfOrganization", () => {
    const teamId = "team123";
    const organizationId = "org123";

    test("returns true when team belongs to organization", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ organizationId });

      const result = await isTeamPartOfOrganization(organizationId, teamId);
      expect(result).toBe(true);
    });

    test("returns false when team belongs to different organization", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ organizationId: "otherOrg" });

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
      const mockContact = { environmentId: "env123" };
      vi.mocked(prisma.contact.findUnique).mockResolvedValue(mockContact);

      const result = await getContact(contactId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.contact.findUnique).toHaveBeenCalledWith({
        where: { id: contactId },
        select: { environmentId: true },
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
      const mockSegment = { environmentId: "env123" };
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(mockSegment);

      const result = await getSegment(segmentId);
      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.segment.findUnique).toHaveBeenCalledWith({
        where: { id: segmentId },
        select: { environmentId: true },
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
});
