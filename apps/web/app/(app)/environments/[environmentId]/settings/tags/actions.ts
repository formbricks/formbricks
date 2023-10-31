"use server";

import { deleteTag, mergeTags, updateTagName } from "@formbricks/lib/tag/service";
import { canUserAccessTag, verifyUserRoleAccess } from "@formbricks/lib/tag/auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { getServerSession } from "next-auth";
import { AuthorizationError } from "@formbricks/types/errors";

export const deleteTagAction = async (tagId: string, environmentId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const { hasDeleteAccess } = await verifyUserRoleAccess(environmentId, session.user.id);
  if (!hasDeleteAccess) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTag(session.user.id, tagId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await deleteTag(tagId);
};

export const updateTagNameAction = async (tagId: string, name: string, environmentId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const { hasCreateOrUpdateAccess } = await verifyUserRoleAccess(environmentId, session.user.id);
  if (!hasCreateOrUpdateAccess) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessTag(session.user.id, tagId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await updateTagName(tagId, name);
};

export const mergeTagsAction = async (originalTagId: string, newTagId: string, environmentId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const { hasCreateOrUpdateAccess } = await verifyUserRoleAccess(environmentId, session.user.id);
  if (!hasCreateOrUpdateAccess) throw new AuthorizationError("Not authorized");

  const isAuthorizedForOld = await canUserAccessTag(session.user.id, originalTagId);
  const isAuthorizedForNew = await canUserAccessTag(session.user.id, newTagId);
  if (!isAuthorizedForOld || !isAuthorizedForNew) throw new AuthorizationError("Not authorized");

  return await mergeTags(originalTagId, newTagId);
};
