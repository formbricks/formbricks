import { ZId } from "@formbricks/types/v1/environment";
import { validateInputs } from "../utils/validate";
import { getResponseNote } from "./service";
import { unstable_cache } from "next/cache";

export const canUserAccessResponseNote = async (userId: string, responseNoteId: string): Promise<boolean> =>
  await unstable_cache(
    async () => {
      validateInputs([userId, ZId], [responseNoteId, ZId]);

      if (!userId || !responseNoteId) return false;

      const responseNote = await getResponseNote(responseNoteId);
      if (!responseNote) return false;

      return responseNote.user.id === userId;
    },
    [`users-${userId}-responseNotes-${responseNoteId}`],
    { revalidate: 30 * 60, tags: [`responseNotes-${responseNoteId}`] }
  )(); // 30 minutes
