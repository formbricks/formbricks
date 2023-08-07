"use server";

import { deleteApiKey, createApiKey } from "@formbricks/lib/services/apiKey";
import { TApiKeyData } from "@formbricks/types/v1/apiKeys";

export async function deleteApiKeyAction(id: string) {
  return await deleteApiKey(id);
}
export async function createApiKeyAction(environmentId: string, apiKeyData: TApiKeyData) {
  return await createApiKey(environmentId, apiKeyData);
}
