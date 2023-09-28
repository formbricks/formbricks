"use server";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { hasUserEnvironmentAccessCached } from "@formbricks/lib/environment/auth";
import { deleteApiKey, createApiKey } from "@formbricks/lib/apiKey/service";
import { canUserAccessApiKey } from "@formbricks/lib/apiKey/auth";
import { TApiKeyCreateInput } from "@formbricks/types/v1/apiKeys";
import { getServerSession } from "next-auth";

export async function deleteApiKeyAction(id: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("You are not authorized to perform this action.");
  const isAuthorized = await canUserAccessApiKey(session.user.id, id);

  if (isAuthorized) {
    return await deleteApiKey(id);
  } else {
    throw new Error("You are not authorized to perform this action.");
  }
}
export async function createApiKeyAction(environmentId: string, apiKeyData: TApiKeyCreateInput) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("You are not authorized to perform this action.");
  const isAuthorized = await hasUserEnvironmentAccessCached(session.user.id, environmentId);

  if (isAuthorized) {
    return await createApiKey(environmentId, apiKeyData);
  } else {
    throw new Error("You are not authorized to perform this action.");
  }
}
