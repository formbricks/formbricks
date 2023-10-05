"use server";

import { getServerSession } from "next-auth";
import { AuthorizationError } from "../../types/v1/errors";
import { authOptions } from "../../../apps/web/app/api/auth/[...nextauth]/authOptions";
import { deleteResponse } from "@formbricks/lib/response/service";
import { canUserAccessResponse } from "@formbricks/lib/response/auth";
import { updateResponseNote, resolveResponseNote } from "@formbricks/lib/services/responseNote";

export const deleteResponseAction = async (responseId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");
  const isAuthorized = await canUserAccessResponse(session.user!.id, responseId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await deleteResponse(responseId);
};

export const updateResponseNoteAction = async (responseNoteId: string, text: string) => {
  await updateResponseNote(responseNoteId, text);
};

export const resolveResponseNoteAction = async (responseNoteId: string) => {
  await resolveResponseNote(responseNoteId);
};
