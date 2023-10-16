"use server";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import { getSpreadSheets } from "@formbricks/lib/googleSheet/service";
import { createOrUpdateIntegration, deleteIntegration } from "@formbricks/lib/integration/service";

import { canUserAccessIntegration } from "@formbricks/lib/integration/auth";
import { AuthorizationError } from "@formbricks/types/v1/errors";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { TGoogleSheetIntegrationInput } from "@formbricks/types/v1/integrations";

export async function upsertIntegrationAction(
  environmentId: string,
  integrationData: TGoogleSheetIntegrationInput
) {
  return await createOrUpdateIntegration(environmentId, integrationData);
}

export async function deleteIntegrationAction(integrationId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessIntegration(session.user.id, integrationId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await deleteIntegration(integrationId);
}

export async function refreshSheetAction(environmentId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await getSpreadSheets(environmentId);
}
