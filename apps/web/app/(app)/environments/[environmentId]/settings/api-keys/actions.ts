"use server";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { deleteApiKey, createApiKey } from "@formbricks/lib/apiKey/service";
import { canUserAccessApiKey } from "@formbricks/lib/apiKey/auth";
import { TApiKeyCreateInput } from "@formbricks/types/v1/apiKeys";
import { getServerSession } from "next-auth";
import { AuthorizationError } from "@formbricks/types/v1/errors";

export async function deleteApiKeyAction(id: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessApiKey(session.user.id, id);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await deleteApiKey(id);
}
export async function createApiKeyAction(environmentId: string, apiKeyData: TApiKeyCreateInput) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await createApiKey(environmentId, apiKeyData);
}
