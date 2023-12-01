"use server";

import { getSpreadSheets } from "@formbricks/lib/googleSheet/service";
import { createOrUpdateIntegration, deleteIntegration } from "@formbricks/lib/integration/service";
import { TSlackIntegration } from "@formbricks/types/v1/integrations";

export async function upsertIntegrationAction(
  environmentId: string,
  integrationData: Partial<TSlackIntegration>
) {
  return await createOrUpdateIntegration(environmentId, integrationData);
}

export async function deleteIntegrationAction(integrationId: string) {
  return await deleteIntegration(integrationId);
}

export async function refreshSheetAction(environmentId: string) {
  return await getSpreadSheets(environmentId);
}
