"use server";

import { createOrUpdateIntegration, deleteIntegration } from "@formbricks/lib/services/integrations";


export async function upsertIntegrationAction(environmentId: string, integrationData: any) {
  return await createOrUpdateIntegration(environmentId, integrationData);
}

export async function deleteIntegrationAction(integrationId: string) {
  return await deleteIntegration(integrationId);
}

