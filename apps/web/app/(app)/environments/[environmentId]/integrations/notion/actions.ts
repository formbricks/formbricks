"use server";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { createOrUpdateIntegration, deleteIntegration } from "@formbricks/lib/integration/service";
import { getNotionDatabases } from "@formbricks/lib/notion/service";
import { TIntegrationInput } from "@formbricks/types/integration";
import { getServerSession } from "next-auth";
import { AuthorizationError } from "@formbricks/types/errors";
import { canUserAccessIntegration } from "@formbricks/lib/integration/auth";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";

export async function deleteIntegrationAction(integrationId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessIntegration(session.user.id, integrationId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await deleteIntegration(integrationId);
}

export async function refreshDatabasesAction(environmentId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await getNotionDatabases(environmentId);
}

export async function upsertIntegrationAction(environmentId: string, integrationData: TIntegrationInput) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await createOrUpdateIntegration(environmentId, integrationData);
}
