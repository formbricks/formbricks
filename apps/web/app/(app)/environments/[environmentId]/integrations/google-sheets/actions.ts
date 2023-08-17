"use server";

import { createIntegration, deleteIntegration } from "@formbricks/lib/services/integrations";

export async function createIntegrationAction(environmentId: string, integrationData: any) {
  return await createIntegration(environmentId, integrationData);
}

export async function deleteIntegrationAction(integrationId: string) {
  return await deleteIntegration(integrationId);
}
