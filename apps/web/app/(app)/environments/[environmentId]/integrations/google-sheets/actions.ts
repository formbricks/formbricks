"use server";

import { createOrUpdateIntegration, deleteIntegration } from "@formbricks/lib/services/integrations";
import { authorize } from "@formbricks/lib/services/google";


export async function upsertIntegrationAction(environmentId: string, integrationData: any) {
  return await createOrUpdateIntegration(environmentId, integrationData);
}

export async function deleteIntegrationAction(integrationId: string) {
  return await deleteIntegration(integrationId);
}

export async function authorizeAction(){
  return await authorize()
}
