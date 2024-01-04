"use server";

import { getServerSession } from "next-auth";

import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { createTag } from "@formbricks/lib/tag/service";
import { canUserAccessTagOnResponse } from "@formbricks/lib/tagOnResponse/auth";
import { addTagToRespone, deleteTagOnResponse } from "@formbricks/lib/tagOnResponse/service";
import { AuthorizationError } from "@formbricks/types/errors";

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
