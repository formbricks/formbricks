"use server";

import { getServerSession } from "next-auth";

import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getSpreadsheetNameById } from "@formbricks/lib/googleSheet/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { TIntegrationGoogleSheetsCredential } from "@formbricks/types/integration/googleSheet";

export async function getSpreadsheetNameByIdAction(
  credentials: TIntegrationGoogleSheetsCredential,
  environmentId: string,
  spreadsheetId: string
) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await getSpreadsheetNameById(credentials, spreadsheetId);
}
