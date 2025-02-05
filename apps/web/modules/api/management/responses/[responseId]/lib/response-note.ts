import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { responseNoteCache } from "@formbricks/lib/responseNote/cache";
import { responseNoteSelect } from "@formbricks/lib/responseNote/service";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponseNote } from "@formbricks/types/responses";

export const getResponseNotes = reactCache(
  async (responseId: string): Promise<TResponseNote[]> =>
    cache(
      async () => {
        try {
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
          console.error(error);
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`management-getResponseNotes-${responseId}`],
      {
        tags: [responseNoteCache.tag.byResponseId(responseId)],
      }
    )()
);
