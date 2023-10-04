"use server";

import { deleteTag, mergeTags, updateTagName } from "@formbricks/lib/tag/service";
import { canUserAccessTag } from "@formbricks/lib/tag/auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import { AuthorizationError } from "@formbricks/types/v1/errors";

export const deleteTagAction = async (tagId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTag(session.user.id, tagId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await deleteTag(tagId);
};

export const updateTagNameAction = async (tagId: string, name: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTag(session.user.id, tagId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await updateTagName(tagId, name);
};

export const mergeTagsAction = async (originalTagId: string, newTagId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorizedForOld = await canUserAccessTag(session.user.id, originalTagId);
  const isAuthorizedForNew = await canUserAccessTag(session.user.id, newTagId);
  if (!isAuthorizedForOld || !isAuthorizedForNew) throw new AuthorizationError("Not authorized");

  return await mergeTags(originalTagId, newTagId);
};
