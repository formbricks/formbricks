"use server";

import { deleteResponse } from "@formbricks/lib/services/response";
import { updateResponseNote, resolveResponseNote } from "@formbricks/lib/services/responseNote";
import { createTag } from "@formbricks/lib/services/tag";
import { addTagToRespone, deleteTagFromResponse } from "@formbricks/lib/services/tagOnResponse";

export const updateResponseNoteAction = async (responseNoteId: string, text: string) => {
  await updateResponseNote(responseNoteId, text);
};

export const resolveResponseNoteAction = async (responseNoteId: string) => {
  await resolveResponseNote(responseNoteId);
};

export const deleteResponseAction = async (responseId: string) => {
  return await deleteResponse(responseId);
};

export const createTagAction = async (environmentId: string, tagName: string) => {
  return await createTag(environmentId, tagName);
};

export const addTagToResponeAction = async (responseId: string, tagId: string) => {
  return await addTagToRespone(responseId, tagId);
};

export const removeTagFromResponseAction = async (responseId: string, tagId: string) => {
  return await deleteTagFromResponse(responseId, tagId);
};
