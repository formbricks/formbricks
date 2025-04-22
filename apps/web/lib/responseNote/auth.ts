import { cache } from "@/lib/cache";
import { ZId } from "@formbricks/types/common";
import { canUserAccessResponse } from "../response/auth";
import { getResponse } from "../response/service";
import { validateInputs } from "../utils/validate";
import { responseNoteCache } from "./cache";
import { getResponseNote } from "./service";

export const canUserModifyResponseNote = async (userId: string, responseNoteId: string): Promise<boolean> =>
  cache(
    async () => {
      validateInputs([userId, ZId], [responseNoteId, ZId]);

      if (!userId || !responseNoteId) return false;

      try {
        const responseNote = await getResponseNote(responseNoteId);
        if (!responseNote) return false;

        return responseNote.user.id === userId;
      } catch (error) {
        throw error;
      }
    },
    [`canUserModifyResponseNote-${userId}-${responseNoteId}`],
    {
      tags: [responseNoteCache.tag.byId(responseNoteId)],
    }
  )();

export const canUserResolveResponseNote = async (
  userId: string,
  responseId: string,
  responseNoteId: string
): Promise<boolean> =>
  cache(
    async () => {
      validateInputs([userId, ZId], [responseNoteId, ZId]);

      if (!userId || !responseId || !responseNoteId) return false;

      try {
        const response = await getResponse(responseId);

        let noteExistsOnResponse = false;

        response?.notes.forEach((note) => {
          if (note.id === responseNoteId) {
            noteExistsOnResponse = true;
          }
        });

        if (!noteExistsOnResponse) return false;

        const canAccessResponse = await canUserAccessResponse(userId, responseId);

        return canAccessResponse;
      } catch (error) {
        throw error;
      }
    },
    [`canUserResolveResponseNote-${userId}-${responseNoteId}`],
    {
      tags: [responseNoteCache.tag.byId(responseNoteId)],
    }
  )();
