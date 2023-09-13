"use server";

import { getSpreadSheets } from "@formbricks/lib/services/googleSheet";
import { createOrUpdateIntegration, deleteIntegration } from "@formbricks/lib/services/integrations";
import { TGoogleSheetIntegration } from "@formbricks/types/v1/integrations";

export async function upsertIntegrationAction(
  environmentId: string,
  integrationData: Partial<TGoogleSheetIntegration>
) {
  return await createOrUpdateIntegration(environmentId, integrationData);
}

export async function deleteIntegrationAction(integrationId: string) {
  return await deleteIntegration(integrationId);
}

export async function refreshSheetAction(environmentId: string) {
  return await getSpreadSheets(environmentId);
}
