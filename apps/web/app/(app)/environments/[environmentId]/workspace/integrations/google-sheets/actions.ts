"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import {
  TIntegrationGoogleSheets,
  ZIntegrationGoogleSheets,
} from "@formbricks/types/integration/google-sheet";
import { getSpreadsheetNameById, validateGoogleSheetsConnection } from "@/lib/googleSheet/service";
import { getIntegrationByType } from "@/lib/integration/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromEnvironmentId, getProjectIdFromEnvironmentId } from "@/lib/utils/helper";

const ZValidateGoogleSheetsConnectionAction = z.object({
  environmentId: ZId,
});

export const validateGoogleSheetsConnectionAction = authenticatedActionClient
  .schema(ZValidateGoogleSheetsConnectionAction)
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

    const integration = await getIntegrationByType(parsedInput.environmentId, "googleSheets");
    if (!integration) {
      return { data: false };
    }

    await validateGoogleSheetsConnection(integration as TIntegrationGoogleSheets);
    return { data: true };
  });

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
