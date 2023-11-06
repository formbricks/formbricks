"use server";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getSpreadSheets } from "@formbricks/lib/googleSheet/service";
import { getServerSession } from "next-auth";

import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { AuthorizationError } from "@formbricks/types/errors";

export async function refreshSheetAction(environmentId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await getSpreadSheets(environmentId);
}
