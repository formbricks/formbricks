"use server";

import { updateResponseNote, resolveResponseNote } from "@formbricks/lib/services/responseNote";

export const updateResponseNoteAction = async (responseId: string, noteId: string, text: string) => {
  await updateResponseNote(responseId, noteId, text);
};

export const resolveResponseNoteAction = async (responseId: string, noteId: string) => {
  await resolveResponseNote(responseId, noteId);
};
