"use server";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { canUserAccessApiKey } from "@/lib/authorization";
import { deleteApiKey, createApiKey } from "@formbricks/lib/services/apiKey";
import { TApiKeyCreateInput } from "@formbricks/types/v1/apiKeys";
import { getServerSession } from "next-auth";

export async function deleteApiKeyAction(id: string) {
  const session = await getServerSession(authOptions);
  const authorized = await canUserAccessApiKey(session, id);

  if (authorized) {
    return await deleteApiKey(id);
  } else {
    throw new Error("You are not authorized to perform this action.");
  }
}
export async function createApiKeyAction(environmentId: string, apiKeyData: TApiKeyCreateInput) {
  return await createApiKey(environmentId, apiKeyData);
}
