"use server";

import { deleteResponse } from "@formbricks/lib/response/service";
import { updateResponseNote, resolveResponseNote } from "@formbricks/lib/responseNote/service";
import { createTag } from "@formbricks/lib/tag/service";
import { addTagToRespone, deleteTagOnResponse } from "@formbricks/lib/tagOnResponse/service";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import { AuthorizationError } from "@formbricks/types/v1/errors";
import { canUserAccessResponse } from "@formbricks/lib/response/auth";
import { canUserAccessTagOnResponse } from "@formbricks/lib/tagOnResponse/auth";

export const updateResponseNoteAction = async (responseNoteId: string, text: string) => {
  await updateResponseNote(responseNoteId, text);
};

export const resolveResponseNoteAction = async (responseNoteId: string) => {
  await resolveResponseNote(responseNoteId);
};

export const deleteResponseAction = async (responseId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessResponse(session.user.id, responseId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await deleteResponse(responseId);
};

export const createTagAction = async (environmentId: string, tagName: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await createTag(environmentId, tagName);
};

export const createTagToResponeAction = async (responseId: string, tagId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTagOnResponse(session.user.id, tagId, responseId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await addTagToRespone(responseId, tagId);
};

export const deleteTagOnResponseAction = async (responseId: string, tagId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTagOnResponse(session.user.id, tagId, responseId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await deleteTagOnResponse(responseId, tagId);
};
