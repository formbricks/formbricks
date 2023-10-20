"use server";

import { getAirtableTables } from "@formbricks/lib/airtable/service";
import { createOrUpdateIntegration, deleteIntegration } from "@formbricks/lib/integration/service";
import { TIntegrationInput } from "@formbricks/types/v1/integration";

export async function upsertIntegrationAction(environmentId: string, integrationData: TIntegrationInput) {
  return await createOrUpdateIntegration(environmentId, integrationData);
}

export async function deleteIntegrationAction(integrationId: string) {
  return await deleteIntegration(integrationId);
}

export async function refreshTablesAction(environmentId: string) {
  return await getAirtableTables(environmentId);
}
