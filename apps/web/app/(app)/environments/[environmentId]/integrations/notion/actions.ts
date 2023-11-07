"use server";

import { authOptions } from "@formbricks/lib/authOptions";
import { getNotionDatabases } from "@formbricks/lib/notion/service";
import { getServerSession } from "next-auth";
import { AuthorizationError } from "@formbricks/types/errors";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";

export async function refreshDatabasesAction(environmentId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await getNotionDatabases(environmentId);
}
