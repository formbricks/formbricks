"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TIntegrationGoogleSheets } from "@formbricks/types/integration/google-sheet";
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
  workspaceId: ZId,
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

    // The integration is read from the database rather than accepted from the client. The settings page
    // redacts `config.key` before handing the integration to the client (ENG-2078), so a client-supplied
    // object arrives with blank OAuth tokens and `authorize()` fails with "No refresh token is set."
    // (ENG-2303). Reading it server-side also removes the cross-workspace hijack this action had to
    // guard against explicitly (ENG-1921), since the integration can only come from the authorized
    // workspace.
    const integration = await getIntegrationByType(parsedInput.workspaceId, "googleSheets");
    if (!integration) {
      // No ID to report: the lookup is by workspace and type, not by integration ID. The constructor
      // renders `${resource} not found` for a null ID, which keeps the message accurate if it ever
      // surfaces raw.
      throw new ResourceNotFoundError("Google Sheets integration", null);
    }

    return await getSpreadsheetNameById(integration as TIntegrationGoogleSheets, parsedInput.spreadsheetId);
  });
