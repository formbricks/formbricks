"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import {
  TIntegrationGoogleSheets,
  ZIntegrationGoogleSheets,
} from "@formbricks/types/integration/google-sheet";
import { getSpreadsheetNameById, validateGoogleSheetsConnection } from "@/lib/googleSheet/service";
import { getIntegrationByType } from "@/lib/integration/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";

const ZValidateGoogleSheetsConnectionAction = z.object({
  workspaceId: ZId,
});

export const validateGoogleSheetsConnectionAction = authenticatedActionClient
  .inputSchema(ZValidateGoogleSheetsConnectionAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          workspaceId: parsedInput.workspaceId,
          minPermission: "readWrite",
        },
      ],
    });

    const integration = await getIntegrationByType(parsedInput.workspaceId, "googleSheets");
    if (!integration) {
      return { data: false };
    }

    await validateGoogleSheetsConnection(integration as TIntegrationGoogleSheets);
    return { data: true };
  });

const ZGetSpreadsheetNameByIdAction = z.object({
  googleSheetIntegration: ZIntegrationGoogleSheets,
  workspaceId: z.string(),
  spreadsheetId: z.string(),
});

export const getSpreadsheetNameByIdAction = authenticatedActionClient
  .inputSchema(ZGetSpreadsheetNameByIdAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          workspaceId: parsedInput.workspaceId,
          minPermission: "readWrite",
        },
      ],
    });

    // ENG-1921: googleSheetIntegration is fully client-supplied and carries its own workspaceId,
    // which is used downstream to upsert the integration (incl. OAuth tokens) on the token-refresh
    // path. Reject it unless it targets the authorized workspace, otherwise a caller could
    // create/overwrite another tenant's integration.
    if (parsedInput.googleSheetIntegration.workspaceId !== parsedInput.workspaceId) {
      throw new OperationNotAllowedError("Integration does not belong to the specified workspace");
    }

    const integrationData = structuredClone(parsedInput.googleSheetIntegration);
    integrationData.config.data.forEach((data) => {
      data.createdAt = new Date(data.createdAt);
    });

    return await getSpreadsheetNameById(integrationData, parsedInput.spreadsheetId);
  });
