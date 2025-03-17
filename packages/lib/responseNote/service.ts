import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponseNote } from "@formbricks/types/responses";
import { cache } from "../cache";
import { responseCache } from "../response/cache";
import { validateInputs } from "../utils/validate";
import { responseNoteCache } from "./cache";

export const responseNoteSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  text: true,
  isEdited: true,
  isResolved: true,
  user: {
    select: {
      id: true,
      name: true,
    },
  },
  response: {
    select: {
      id: true,
      surveyId: true,
    },
  },
};

export const createResponseNote = async (
  responseId: string,
  userId: string,
  text: string
): Promise<TResponseNote> => {
  validateInputs([responseId, ZId], [userId, ZId], [text, ZString]);

  try {
    const responseNote = await prisma.responseNote.create({
      data: {
        responseId: responseId,
        userId: userId,
        text: text,
      },
      select: responseNoteSelect,
    });

    responseCache.revalidate({
      id: responseNote.response.id,
      surveyId: responseNote.response.surveyId,
    });

    responseNoteCache.revalidate({
      id: responseNote.id,
      responseId: responseNote.response.id,
    });
    return responseNote;
  } catch (error) {
    logger.error(error, "Error creating response note:");
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getResponseNote = reactCache(
  async (responseNoteId: string): Promise<(TResponseNote & { responseId: string }) | null> =>
    cache(
      async () => {
        try {
          const responseNote = await prisma.responseNote.findUnique({
            where: {
              id: responseNoteId,
            },
            select: {
              ...responseNoteSelect,
              responseId: true,
            },
          });
          return responseNote;
        } catch (error) {
          logger.error(error, "Error getting response note:");
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getResponseNote-${responseNoteId}`],
      {
        tags: [responseNoteCache.tag.byId(responseNoteId)],
      }
    )()
);

export const getResponseNotes = reactCache(
  async (responseId: string): Promise<TResponseNote[]> =>
    cache(
      async () => {
        try {
          validateInputs([responseId, ZId]);

          const responseNotes = await prisma.responseNote.findMany({
            where: {
              responseId,
            },
            select: responseNoteSelect,
          });
          if (!responseNotes) {
            throw new ResourceNotFoundError("Response Notes by ResponseId", responseId);
          }
          return responseNotes;
        } catch (error) {
          logger.error(error, "Error getting response notes:");
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getResponseNotes-${responseId}`],
      {
        tags: [responseNoteCache.tag.byResponseId(responseId)],
      }
    )()
);

export const updateResponseNote = async (responseNoteId: string, text: string): Promise<TResponseNote> => {
  validateInputs([responseNoteId, ZString], [text, ZString]);

  try {
    const updatedResponseNote = await prisma.responseNote.update({
      where: {
        id: responseNoteId,
      },
      data: {
        text: text,
        updatedAt: new Date(),
        isEdited: true,
      },
      select: responseNoteSelect,
    });

    responseCache.revalidate({
      id: updatedResponseNote.response.id,
      surveyId: updatedResponseNote.response.surveyId,
    });

    responseNoteCache.revalidate({
      id: updatedResponseNote.id,
      responseId: updatedResponseNote.response.id,
    });

    return updatedResponseNote;
  } catch (error) {
    logger.error(error, "Error updating response note:");
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const resolveResponseNote = async (responseNoteId: string): Promise<TResponseNote> => {
  validateInputs([responseNoteId, ZString]);

  try {
    const responseNote = await prisma.responseNote.update({
      where: {
        id: responseNoteId,
      },
      data: {
        updatedAt: new Date(),
        isResolved: true,
      },
      select: responseNoteSelect,
    });

    responseCache.revalidate({
      id: responseNote.response.id,
      surveyId: responseNote.response.surveyId,
    });

    responseNoteCache.revalidate({
      id: responseNote.id,
      responseId: responseNote.response.id,
    });

    return responseNote;
  } catch (error) {
    logger.error(error, "Error resolving response note:");
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
