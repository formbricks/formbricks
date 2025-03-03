"use server";

import { authOptions } from "@/modules/auth/lib/authOptions";
import { getServerSession } from "next-auth";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getSpreadsheetNameById } from "@formbricks/lib/googleSheet/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { TIntegrationGoogleSheets } from "@formbricks/types/integration/google-sheet";

export async function getSpreadsheetNameByIdAction(
  googleSheetIntegration: TIntegrationGoogleSheets,
  environmentId: string,
  spreadsheetId: string
) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");
  const integrationData = structuredClone(googleSheetIntegration);
  integrationData.config.data.forEach((data) => {
    data.createdAt = new Date(data.createdAt);
  });
  return await getSpreadsheetNameById(integrationData, spreadsheetId);
}
