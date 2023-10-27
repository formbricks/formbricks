"use server";

import { createOrUpdateIntegration, deleteIntegration } from "@formbricks/lib/integration/service";
import { getNotionDatabases } from "@formbricks/lib/notion/service";
import { TIntegrationInput } from "@formbricks/types/integration";

export async function deleteIntegrationAction(integrationId: string) {
  return await deleteIntegration(integrationId);
}

export async function refreshDatabasesAction(environmentId: string) {
  return await getNotionDatabases(environmentId);
}

export async function upsertIntegrationAction(environmentId: string, integrationData: TIntegrationInput) {
  return await createOrUpdateIntegration(environmentId, integrationData);
}
