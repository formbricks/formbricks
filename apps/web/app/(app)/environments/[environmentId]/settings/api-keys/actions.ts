"use server";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { hasUserEnvironmentAccess } from "@/lib/api/apiHelper";
import { deleteApiKey, createApiKey, canUserAccessApiKey } from "@formbricks/lib/services/apiKey";
import { TApiKeyCreateInput } from "@formbricks/types/v1/apiKeys";
import { Session, getServerSession } from "next-auth";

export async function deleteApiKeyAction(id: string) {
  const session: Session | null = await getServerSession(authOptions);
  const authorized = await canUserAccessApiKey(session, id);

  if (authorized) {
    return await deleteApiKey(id);
  } else {
    throw new Error("You are not authorized to perform this action.");
  }
}
export async function createApiKeyAction(environmentId: string, apiKeyData: TApiKeyCreateInput) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("You are not authorized to perform this action.");

  const authorized = await hasUserEnvironmentAccess(session.user, environmentId);

  if (authorized) {
    return await createApiKey(environmentId, apiKeyData);
  } else {
    throw new Error("You are not authorized to perform this action.");
  }
}
