import "server-only";

import { prisma } from "@formbricks/database";

import { DatabaseError } from "@formbricks/types/v1/errors";
import { TResponseNote } from "@formbricks/types/v1/responses";
import { Prisma } from "@prisma/client";
import { responseCache } from "../response/cache";

const select = {
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
  try {
    const responseNote = await prisma.responseNote.create({
      data: {
        responseId: responseId,
        userId: userId,
        text: text,
      },
      select,
    });

    responseCache.revalidate({
      responseId,
      surveyId: responseNote.response.surveyId,
    });

    return responseNote;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

export const updateResponseNote = async (responseNoteId: string, text: string): Promise<TResponseNote> => {
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
      select,
    });

    responseCache.revalidate({
      responseId: updatedResponseNote.response.id,
      surveyId: updatedResponseNote.response.surveyId,
    });

    return updatedResponseNote;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

export const resolveResponseNote = async (responseNoteId: string): Promise<TResponseNote> => {
  try {
    const responseNote = await prisma.responseNote.update({
      where: {
        id: responseNoteId,
      },
      data: {
        updatedAt: new Date(),
        isResolved: true,
      },
      select,
    });

    responseCache.revalidate({
      responseId: responseNote.response.id,
      surveyId: responseNote.response.surveyId,
    });

    return responseNote;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};
