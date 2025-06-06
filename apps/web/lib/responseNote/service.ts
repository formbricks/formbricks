import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId, ZString } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponseNote } from "@formbricks/types/responses";
import { validateInputs } from "../utils/validate";

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

    return responseNote;
  } catch (error) {
    logger.error(error, "Error creating response note");
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getResponseNote = reactCache(
  async (responseNoteId: string): Promise<(TResponseNote & { responseId: string }) | null> => {
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
      logger.error(error, "Error getting response note");
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

export const getResponseNotes = reactCache(async (responseId: string): Promise<TResponseNote[]> => {
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
    logger.error(error, "Error getting response notes");
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

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

    return updatedResponseNote;
  } catch (error) {
    logger.error(error, "Error updating response note");
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

    return responseNote;
  } catch (error) {
    logger.error(error, "Error resolving response note");
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
