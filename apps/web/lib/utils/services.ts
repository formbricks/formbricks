"use server";

import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId, ZString } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";

export const getActionClass = reactCache(
  async (actionClassId: string): Promise<{ environmentId: string } | null> => {
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

export const getEnvironment = reactCache(
  async (environmentId: string): Promise<{ projectId: string } | null> => {
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
  }
);

export const getIntegration = reactCache(
  async (integrationId: string): Promise<{ environmentId: string } | null> => {
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
  async (projectId: string): Promise<{ organizationId: string } | null> => {
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

export const getResponseNote = reactCache(
  async (responseNoteId: string): Promise<{ responseId: string } | null> => {
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
  }
);

export const getSurvey = reactCache(async (surveyId: string): Promise<{ environmentId: string } | null> => {
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
});

export const getTag = reactCache(async (id: string): Promise<{ environmentId: string } | null> => {
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
});

export const getWebhook = async (id: string): Promise<{ environmentId: string } | null> => {
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
};

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

export const getInsight = reactCache(async (insightId: string): Promise<{ environmentId: string } | null> => {
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
});

export const getDocument = reactCache(
  async (documentId: string): Promise<{ environmentId: string } | null> => {
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
  }
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

export const getContact = reactCache(async (contactId: string): Promise<{ environmentId: string } | null> => {
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
});

export const getSegment = reactCache(async (segmentId: string): Promise<{ environmentId: string } | null> => {
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
});
