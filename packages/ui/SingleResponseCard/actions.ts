"use server";

import { getServerSession } from "next-auth";
import { AuthorizationError } from "@formbricks/types/v1/errors";
import { authOptions } from "@formbricks/lib/authOptions";
import { deleteResponse } from "@formbricks/lib/response/service";
import { canUserAccessResponse } from "@formbricks/lib/response/auth";
import { canUserModifyResponseNote, canUserResolveResponseNote } from "@formbricks/lib/responseNote/auth";
import {
  updateResponseNote,
  resolveResponseNote,
  createResponseNote,
} from "@formbricks/lib/responseNote/service";

import { createTag } from "@formbricks/lib/tag/service";
import { addTagToRespone, deleteTagOnResponse } from "@formbricks/lib/tagOnResponse/service";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { canUserAccessTagOnResponse } from "@formbricks/lib/tagOnResponse/auth";

export const createTagAction = async (environmentId: string, tagName: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user!.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await createTag(environmentId, tagName);
};

export const createTagToResponeAction = async (responseId: string, tagId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTagOnResponse(session.user!.id, tagId, responseId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await addTagToRespone(responseId, tagId);
};

export const deleteTagOnResponseAction = async (responseId: string, tagId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTagOnResponse(session.user!.id, tagId, responseId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await deleteTagOnResponse(responseId, tagId);
};

export const deleteResponseAction = async (responseId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");
  const isAuthorized = await canUserAccessResponse(session.user!.id, responseId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await deleteResponse(responseId);
};

export const updateResponseNoteAction = async (responseNoteId: string, text: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserModifyResponseNote(session.user!.id, responseNoteId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  await updateResponseNote(responseNoteId, text);
};

export const resolveResponseNoteAction = async (responseId: string, responseNoteId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserResolveResponseNote(session.user!.id, responseId, responseNoteId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  await resolveResponseNote(responseNoteId);
};

export const createResponseNoteAction = async (responseId: string, userId: string, text: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");
  const authotized = await canUserAccessResponse(session.user!.id, responseId);
  if (!authotized) throw new AuthorizationError("Not authorized");
  return await createResponseNote(responseId, userId, text);
};
