"use server";

import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId, ZString } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { getQuota as getQuotaService } from "@/modules/ee/quotas/lib/quotas";

export const getActionClass = reactCache(
  async (actionClassId: string): Promise<{ workspaceId: string } | null> => {
    validateInputs([actionClassId, ZId]);

    try {
      const actionClass = await prisma.actionClass.findUnique({
        where: {
          id: actionClassId,
        },
        select: {
          workspaceId: true,
        },
      });

      return actionClass;
    } catch (error) {
      throw new DatabaseError(`Database error when fetching action`);
    }
  }
);

export const getApiKey = reactCache(async (apiKeyId: string): Promise<{ organizationId: string } | null> => {
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
        organizationId: true,
      },
    });

    return apiKeyData;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

export const getIntegration = reactCache(
  async (integrationId: string): Promise<{ workspaceId: string } | null> => {
    try {
      const integration = await prisma.integration.findUnique({
        where: {
          id: integrationId,
        },
        select: {
          workspaceId: true,
        },
      });
      return integration;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getInvite = reactCache(async (inviteId: string): Promise<{ organizationId: string } | null> => {
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
});

export const getLanguage = async (languageId: string): Promise<{ workspaceId: string }> => {
  try {
    validateInputs([languageId, ZId]);

    const language = await prisma.language.findFirst({
      where: { id: languageId },
      select: { workspaceId: true },
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

export const getWorkspace = reactCache(
  async (workspaceId: string): Promise<{ organizationId: string } | null> => {
    try {
      const workspacePrisma = await prisma.workspace.findUnique({
        where: {
          id: workspaceId,
        },
        select: { organizationId: true },
      });

      if (workspacePrisma) return workspacePrisma;

      // Fallback: the id may be a legacy environmentId
      return await prisma.workspace.findUnique({
        where: { legacyEnvironmentId: workspaceId },
        select: { organizationId: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getResponse = reactCache(async (responseId: string): Promise<{ surveyId: string } | null> => {
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
});

export const getSurvey = reactCache(async (surveyId: string): Promise<{ workspaceId: string } | null> => {
  validateInputs([surveyId, ZId]);
  try {
    const survey = await prisma.survey.findUnique({
      where: {
        id: surveyId,
      },
      select: {
        workspaceId: true,
      },
    });

    return survey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

export const getTag = reactCache(async (id: string): Promise<{ workspaceId: string } | null> => {
  validateInputs([id, ZId]);
  const tag = await prisma.tag.findUnique({
    where: {
      id,
    },
    select: {
      workspaceId: true,
    },
  });
  return tag;
});

export const getWebhook = async (id: string): Promise<{ workspaceId: string } | null> => {
  validateInputs([id, ZId]);

  try {
    const webhook = await prisma.webhook.findUnique({
      where: {
        id,
      },
      select: {
        workspaceId: true,
      },
    });
    return webhook;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getQuota = reactCache(async (quotaId: string): Promise<{ surveyId: string }> => {
  validateInputs([quotaId, ZId]);

  const quota = await getQuotaService(quotaId);

  return { surveyId: quota.surveyId };
});

export const getTeam = reactCache(async (teamId: string): Promise<{ organizationId: string } | null> => {
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
});

export const isWorkspacePartOfOrganization = async (
  organizationId: string,
  workspaceId: string
): Promise<boolean> => {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    throw new ResourceNotFoundError("Workspace", workspaceId);
  }
  return workspace.organizationId === organizationId;
};

export const isTeamPartOfOrganization = async (organizationId: string, teamId: string): Promise<boolean> => {
  const team = await getTeam(teamId);
  if (!team) {
    throw new ResourceNotFoundError("Team", teamId);
  }
  return team.organizationId === organizationId;
};

export const getContact = reactCache(async (contactId: string): Promise<{ workspaceId: string } | null> => {
  validateInputs([contactId, ZId]);

  try {
    return await prisma.contact.findUnique({
      where: {
        id: contactId,
      },
      select: { workspaceId: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

export const getSegment = reactCache(async (segmentId: string): Promise<{ workspaceId: string } | null> => {
  validateInputs([segmentId, ZId]);
  try {
    const segment = await prisma.segment.findUnique({
      where: {
        id: segmentId,
      },
      select: { workspaceId: true },
    });

    return segment;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

export const getFeedbackSource = reactCache(
  async (feedbackSourceId: string): Promise<{ workspaceId: string } | null> => {
    validateInputs([feedbackSourceId, ZId]);
    try {
      const feedbackSource = await prisma.feedbackSource.findUnique({
        where: {
          id: feedbackSourceId,
        },
        select: { workspaceId: true },
      });

      return feedbackSource;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);
