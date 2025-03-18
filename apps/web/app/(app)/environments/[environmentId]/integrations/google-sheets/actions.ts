"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromEnvironmentId, getProjectIdFromEnvironmentId } from "@/lib/utils/helper";
import { z } from "zod";
import { getSpreadsheetNameById } from "@formbricks/lib/googleSheet/service";
import { ZIntegrationGoogleSheets } from "@formbricks/types/integration/google-sheet";

const ZGetSpreadsheetNameByIdAction = z.object({
  googleSheetIntegration: ZIntegrationGoogleSheets,
  environmentId: z.string(),
  spreadsheetId: z.string(),
});

export const getSpreadsheetNameByIdAction = authenticatedActionClient
  .schema(ZGetSpreadsheetNameByIdAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
          minPermission: "readWrite",
        },
      ],
    });

    const integrationData = structuredClone(parsedInput.googleSheetIntegration);
    integrationData.config.data.forEach((data) => {
      data.createdAt = new Date(data.createdAt);
    });

    return await getSpreadsheetNameById(integrationData, parsedInput.spreadsheetId);
  });
