"use server";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { createOrUpdateIntegration, deleteIntegration } from "@formbricks/lib/integration/service";
import { getServerSession } from "next-auth";

import { canUserAccessIntegration } from "@formbricks/lib/integration/auth";
import { AuthorizationError } from "@formbricks/types/errors";
import { TIntegrationInput } from "@formbricks/types/integration";

export async function createOrUpdateIntegrationAction(
  environmentId: string,
  integrationData: TIntegrationInput
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
