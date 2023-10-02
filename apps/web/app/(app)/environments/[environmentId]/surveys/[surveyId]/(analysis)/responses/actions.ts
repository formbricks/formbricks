"use server";

import { deleteResponse } from "@formbricks/lib/services/response";
import { updateResponseNote, resolveResponseNote } from "@formbricks/lib/services/responseNote";
import { createTag } from "@formbricks/lib/tag/service";
import { addTagToRespone, deleteTagFromResponse } from "@formbricks/lib/services/tagOnResponse";
import { hasUserEnvironmentAccessCached } from "@formbricks/lib/environment/auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";

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
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("You are not authorized to perform this action.");

  const isAuthorized = await hasUserEnvironmentAccessCached(session.user.id, environmentId);

  if (isAuthorized) {
    return await createTag(environmentId, tagName);
  } else {
    throw new Error("You are not authorized to perform this action.");
  }
};

export const addTagToResponeAction = async (responseId: string, tagId: string) => {
  return await addTagToRespone(responseId, tagId);
};

export const removeTagFromResponseAction = async (responseId: string, tagId: string) => {
  return await deleteTagFromResponse(responseId, tagId);
};
