import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import "server-only";

import { prisma } from "@formbricks/database";
import { ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponseNote, ZResponseNote } from "@formbricks/types/responses";

import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { responseCache } from "../response/cache";
import { formatDateFields } from "../utils/datetime";
import { validateInputs } from "../utils/validate";
import { responseNoteCache } from "./cache";

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
  validateInputs([responseId, ZId], [userId, ZId], [text, ZString]);

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
      id: responseNote.response.id,
      surveyId: responseNote.response.surveyId,
    });

    responseNoteCache.revalidate({
      id: responseNote.id,
      responseId: responseNote.response.id,
    });
    return responseNote;
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getResponseNote = async (responseNoteId: string): Promise<TResponseNote | null> => {
  const responseNote = await unstable_cache(
    async () => {
      try {
        const responseNote = await prisma.responseNote.findUnique({
          where: {
            id: responseNoteId,
          },
          select,
        });
        return responseNote;
      } catch (error) {
        console.error(error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getResponseNote-${responseNoteId}`],
    { tags: [responseNoteCache.tag.byId(responseNoteId)], revalidate: SERVICES_REVALIDATION_INTERVAL }
  )();
  return responseNote ? formatDateFields(responseNote, ZResponseNote) : null;
};

export const getResponseNotes = async (responseId: string): Promise<TResponseNote[]> => {
  const responseNotes = await unstable_cache(
    async () => {
      try {
        validateInputs([responseId, ZId]);

        const responseNotes = await prisma.responseNote.findMany({
          where: {
            responseId,
          },
          select,
        });
        if (!responseNotes) {
          throw new ResourceNotFoundError("Response Notes by ResponseId", responseId);
        }
        return responseNotes;
      } catch (error) {
        console.error(error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getResponseNotes-${responseId}`],
    { tags: [responseNoteCache.tag.byResponseId(responseId)], revalidate: SERVICES_REVALIDATION_INTERVAL }
  )();
  return responseNotes.map((responseNote) => formatDateFields(responseNote, ZResponseNote));
};

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
      select,
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
    console.error(error);
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
      select,
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
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
