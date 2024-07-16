"use server";

import { getServerSession } from "next-auth";
import { canUserAccessApiKey } from "@formbricks/lib/apiKey/auth";
import { createApiKey, deleteApiKey } from "@formbricks/lib/apiKey/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { TApiKeyCreateInput } from "@formbricks/types/api-keys";
import { AuthorizationError } from "@formbricks/types/errors";

export const deleteApiKeyAction = async (id: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessApiKey(session.user.id, id);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await deleteApiKey(id);
};
export const createApiKeyAction = async (environmentId: string, apiKeyData: TApiKeyCreateInput) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await createApiKey(environmentId, apiKeyData);
};
