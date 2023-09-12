"use server";

import { updateResponseNote } from "@formbricks/lib/services/responseNote";

export const updateResponseNoteAction = async (responseId: string, noteId: string, text: string) => {
  await updateResponseNote(responseId, noteId, text);
};
