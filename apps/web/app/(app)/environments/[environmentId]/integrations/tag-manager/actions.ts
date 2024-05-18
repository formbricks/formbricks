"use server";

import { getServerSession } from "next-auth";

import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { canUserAccessGoogleTag } from "@formbricks/lib/googleTag/auth";
import { createGoogleTag, deleteGoogletag, updateGoogleTag } from "@formbricks/lib/googleTag/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { TGoogleTag, TGoogleTagInput } from "@formbricks/types/google-tags";

export const createGoogleTagAction = async (
  environmentId: string,
  tagInput: TGoogleTagInput
): Promise<TGoogleTag> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await createGoogleTag(environmentId, tagInput);
};

export const deleteGoogleTagAction = async (id: string): Promise<TGoogleTag> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessGoogleTag(session.user.id, id);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await deleteGoogletag(id);
};

export const updateGoogleTagAction = async (
  environmentId: string,
  id: string,
  googleTagInput: Partial<TGoogleTagInput>
): Promise<TGoogleTag> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessGoogleTag(session.user.id, id);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await updateGoogleTag(environmentId, id, googleTagInput);
};
