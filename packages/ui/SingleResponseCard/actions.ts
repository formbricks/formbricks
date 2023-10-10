"use server";

import { getServerSession } from "next-auth";
import { AuthorizationError } from "@formbricks/types/v1/errors";
import { authOptions } from "@formbricks/lib/authOptions";
import { deleteResponse } from "@formbricks/lib/response/service";
import { canUserAccessResponse } from "@formbricks/lib/response/auth";
import {
  updateResponseNote,
  resolveResponseNote,
  createResponseNote,
} from "@formbricks/lib/responseNote/service";

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
  await updateResponseNote(responseNoteId, text);
};

export const resolveResponseNoteAction = async (responseNoteId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");
  await resolveResponseNote(responseNoteId);
};

export const createResponseNoteAction = async (responseId: string, userId: string, text: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");
  const authotized = await canUserAccessResponse(session.user!.id, responseId);
  if (!authotized) throw new AuthorizationError("Not authorized");
  return await createResponseNote(responseId, userId, text);
};
