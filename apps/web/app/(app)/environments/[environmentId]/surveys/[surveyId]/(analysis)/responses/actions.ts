"use server";

import { deleteResponse } from "@formbricks/lib/services/response";
import { updateResponseNote, resolveResponseNote } from "@formbricks/lib/services/responseNote";

export const updateResponseNoteAction = async (responseNoteId: string, text: string) => {
  await updateResponseNote(responseNoteId, text);
};

export const resolveResponseNoteAction = async (responseNoteId: string) => {
  await resolveResponseNote(responseNoteId);
};

export const deleteResponseAction = async (responseId: string) => {
  return await deleteResponse(responseId);
};
