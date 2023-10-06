"use server";

import { getAirtableTables } from "@formbricks/lib/services/airTable";
import { createOrUpdateIntegration, deleteIntegration } from "@formbricks/lib/integration/service";
import { TAirTableIntegration } from "@formbricks/types/v1/integrations";

export async function upsertIntegrationAction(
  environmentId: string,
  integrationData: Partial<TAirTableIntegration>
) {
  return await createOrUpdateIntegration(environmentId, integrationData);
}

export async function deleteIntegrationAction(integrationId: string) {
  return await deleteIntegration(integrationId);
}

export async function refreshTablesAction(environmentId: string) {
  return await getAirtableTables(environmentId);
}
