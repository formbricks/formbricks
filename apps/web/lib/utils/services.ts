"use server";

import { apiKeyCache } from "@/lib/cache/api-key";
import { contactCache } from "@/lib/cache/contact";
import { inviteCache } from "@/lib/cache/invite";
import { teamCache } from "@/lib/cache/team";
import { webhookCache } from "@/lib/cache/webhook";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { actionClassCache } from "@formbricks/lib/actionClass/cache";
import { cache } from "@formbricks/lib/cache";
import { segmentCache } from "@formbricks/lib/cache/segment";
import { environmentCache } from "@formbricks/lib/environment/cache";
import { integrationCache } from "@formbricks/lib/integration/cache";
import { projectCache } from "@formbricks/lib/project/cache";
import { responseCache } from "@formbricks/lib/response/cache";
import { responseNoteCache } from "@formbricks/lib/responseNote/cache";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { tagCache } from "@formbricks/lib/tag/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId, ZString } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";

export const getActionClass = reactCache(
  async (actionClassId: string): Promise<{ environmentId: string } | null> =>
    cache(
      async () => {
        validateInputs([actionClassId, ZId]);

        try {
          const actionClass = await prisma.actionClass.findUnique({
            where: {
              id: actionClassId,
            },
            select: {
              environmentId: true,
            },
          });

          return actionClass;
        } catch (error) {
          throw new DatabaseError(`Database error when fetching action`);
        }
      },
      [`utils-getActionClass-${actionClassId}`],
      {
        tags: [actionClassCache.tag.byId(actionClassId)],
      }
    )()
);

export const getApiKey = reactCache(
  async (apiKeyId: string): Promise<{ environmentId: string } | null> =>
    cache(
      async () => {
        validateInputs([apiKeyId, ZString]);

        if (!apiKeyId) {
          throw new InvalidInputError("API key cannot be null or undefined.");
        }

        try {
          const apiKeyData = await prisma.apiKey.findUnique({
            where: {
              id: apiKeyId,
            },
            select: {
              environmentId: true,
            },
          });

          return apiKeyData;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`utils-getApiKey-${apiKeyId}`],
      {
        tags: [apiKeyCache.tag.byId(apiKeyId)],
      }
    )()
);

export const getEnvironment = reactCache(
  async (environmentId: string): Promise<{ projectId: string } | null> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);

        try {
          const environment = await prisma.environment.findUnique({
            where: {
              id: environmentId,
            },
            select: {
              projectId: true,
            },
          });
          return environment;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`utils-getEnvironment-${environmentId}`],
      {
        tags: [environmentCache.tag.byId(environmentId)],
      }
    )()
);

export const getIntegration = reactCache(
  async (integrationId: string): Promise<{ environmentId: string } | null> =>
    cache(
      async () => {
        try {
          const integration = await prisma.integration.findUnique({
            where: {
              id: integrationId,
            },
            select: {
              environmentId: true,
            },
          });
          return integration;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`utils-getIntegration-${integrationId}`],
      {
        tags: [integrationCache.tag.byId(integrationId)],
      }
    )()
);

export const getInvite = reactCache(
  async (inviteId: string): Promise<{ organizationId: string } | null> =>
    cache(
      async () => {
        validateInputs([inviteId, ZString]);

        try {
          const invite = await prisma.invite.findUnique({
            where: {
              id: inviteId,
            },
            select: {
              organizationId: true,
            },
          });

          return invite;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`utils-getInvite-${inviteId}`],
      {
        tags: [inviteCache.tag.byId(inviteId)],
      }
    )()
);

export const getLanguage = async (languageId: string): Promise<{ projectId: string }> => {
  try {
    validateInputs([languageId, ZId]);

    const language = await prisma.language.findFirst({
      where: { id: languageId },
      select: { projectId: true },
    });

    if (!language) {
      throw new ResourceNotFoundError("Language", languageId);
    }

    return language;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getProject = reactCache(
  async (projectId: string): Promise<{ organizationId: string } | null> =>
    cache(
      async () => {
        try {
          const projectPrisma = await prisma.project.findUnique({
            where: {
              id: projectId,
            },
            select: { organizationId: true },
          });
          return projectPrisma;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`utils-getProject-${projectId}`],
      {
        tags: [projectCache.tag.byId(projectId)],
      }
    )()
);

export const getResponse = reactCache(
  async (responseId: string): Promise<{ surveyId: string } | null> =>
    cache(
      async () => {
        validateInputs([responseId, ZId]);

        try {
          const response = await prisma.response.findUnique({
            where: {
              id: responseId,
            },
            select: { surveyId: true },
          });

          return response;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`utils-getResponse-${responseId}`],
      {
        tags: [responseCache.tag.byId(responseId), responseNoteCache.tag.byResponseId(responseId)],
      }
    )()
);

export const getResponseNote = reactCache(
  async (responseNoteId: string): Promise<{ responseId: string } | null> =>
    cache(
      async () => {
        try {
          const responseNote = await prisma.responseNote.findUnique({
            where: {
              id: responseNoteId,
            },
            select: {
              responseId: true,
            },
          });
          return responseNote;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`utils-getResponseNote-${responseNoteId}`],
      {
        tags: [responseNoteCache.tag.byId(responseNoteId)],
      }
    )()
);

export const getSurvey = reactCache(
  async (surveyId: string): Promise<{ environmentId: string } | null> =>
    cache(
      async () => {
        validateInputs([surveyId, ZId]);
        try {
          const survey = await prisma.survey.findUnique({
            where: {
              id: surveyId,
            },
            select: {
              environmentId: true,
            },
          });

          return survey;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`utils-getSurvey-${surveyId}`],
      {
        tags: [surveyCache.tag.byId(surveyId)],
      }
    )()
);

export const getTag = reactCache(
  async (id: string): Promise<{ environmentId: string } | null> =>
    cache(
      async () => {
        validateInputs([id, ZId]);
        const tag = await prisma.tag.findUnique({
          where: {
            id,
          },
          select: {
            environmentId: true,
          },
        });
        return tag;
      },
      [`utils-getTag-${id}`],
      {
        tags: [tagCache.tag.byId(id)],
      }
    )()
);

export const getWebhook = async (id: string): Promise<{ environmentId: string } | null> =>
  cache(
    async () => {
      validateInputs([id, ZId]);

      try {
        const webhook = await prisma.webhook.findUnique({
          where: {
            id,
          },
          select: {
            environmentId: true,
          },
        });
        return webhook;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`utils-getWebhook-${id}`],
    {
      tags: [webhookCache.tag.byId(id)],
    }
  )();

export const getTeam = reactCache(
  async (teamId: string): Promise<{ organizationId: string } | null> =>
    cache(
      async () => {
        validateInputs([teamId, ZString]);

        try {
          const team = await prisma.team.findUnique({
            where: {
              id: teamId,
            },
            select: {
              organizationId: true,
            },
          });

          return team;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`utils-getTeam-${teamId}`],
      {
        tags: [teamCache.tag.byId(teamId)],
      }
    )()
);

export const getInsight = reactCache(
  async (insightId: string): Promise<{ environmentId: string } | null> =>
    cache(
      async () => {
        validateInputs([insightId, ZId]);

        try {
          const insight = await prisma.insight.findUnique({
            where: {
              id: insightId,
            },
            select: {
              environmentId: true,
            },
          });

          return insight;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`utils-getInsight-${insightId}`],
      {
        tags: [tagCache.tag.byId(insightId)],
      }
    )()
);

export const getDocument = reactCache(
  async (documentId: string): Promise<{ environmentId: string } | null> =>
    cache(
      async () => {
        validateInputs([documentId, ZId]);

        try {
          const document = await prisma.document.findUnique({
            where: {
              id: documentId,
            },
            select: {
              environmentId: true,
            },
          });

          return document;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`utils-getDocument-${documentId}`],
      {
        tags: [tagCache.tag.byId(documentId)],
      }
    )()
);

export const isProjectPartOfOrganization = async (
  organizationId: string,
  projectId: string
): Promise<boolean> => {
  const project = await getProject(projectId);
  if (!project) {
    throw new ResourceNotFoundError("Project", projectId);
  }
  return project.organizationId === organizationId;
};

export const isTeamPartOfOrganization = async (organizationId: string, teamId: string): Promise<boolean> => {
  const team = await getTeam(teamId);
  if (!team) {
    throw new ResourceNotFoundError("Team", teamId);
  }
  return team.organizationId === organizationId;
};

export const getContact = reactCache(
  async (contactId: string): Promise<{ environmentId: string } | null> =>
    cache(
      async () => {
        validateInputs([contactId, ZId]);

        try {
          return await prisma.contact.findUnique({
            where: {
              id: contactId,
            },
            select: { environmentId: true },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`utils-getPerson-${contactId}`],
      {
        tags: [contactCache.tag.byId(contactId)],
      }
    )()
);

export const getSegment = reactCache(
  async (segmentId: string): Promise<{ environmentId: string } | null> =>
    cache(
      async () => {
        validateInputs([segmentId, ZId]);
        try {
          const segment = await prisma.segment.findUnique({
            where: {
              id: segmentId,
            },
            select: { environmentId: true },
          });

          return segment;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`utils-getSegment-${segmentId}`],
      {
        tags: [segmentCache.tag.byId(segmentId)],
      }
    )()
);
