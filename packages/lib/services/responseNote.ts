import "server-only";

import { prisma } from "@formbricks/database";

import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { Prisma } from "@prisma/client";

export const updateResponseNote = async (responseId: string, noteId: string, text: string): Promise<any> => {
  try {
    const currentResponse = await prisma.response.findUnique({
      where: {
        id: responseId,
      },
      select: {
        notes: true,
      },
    });

    if (!currentResponse) {
      throw new ResourceNotFoundError("Response", "No Response Found");
    }

    const currentNote = currentResponse.notes.find((eachnote) => eachnote.id === noteId);

    if (!currentNote) {
      throw new ResourceNotFoundError("Note", "No Note Found");
    }

    const updatedResponse = await prisma.response.update({
      where: {
        id: responseId,
      },
      data: {
        notes: {
          updateMany: {
            where: {
              id: noteId,
            },
            data: {
              text: text,
              updatedAt: new Date(),
            },
          },
        },
      },
    });
    return updatedResponse;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};
