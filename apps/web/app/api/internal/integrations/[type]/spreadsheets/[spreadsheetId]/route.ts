import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { problemNotFound } from "@/app/api/v3/lib/response";
import { getSpreadsheetOperation } from "../../../lib/operations";
import { ZIntegrationWorkspaceQuery, ZSpreadsheetParams } from "../../../schemas";

/**
 * `GET /api/internal/integrations/googleSheets/spreadsheets/{spreadsheetId}?workspaceId=`: a
 * spreadsheet's name, before a mapping is saved against it.
 */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZSpreadsheetParams, query: ZIntegrationWorkspaceQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    parsedInput.params.type === "googleSheets"
      ? getSpreadsheetOperation({
          authentication,
          workspaceId: parsedInput.query.workspaceId,
          spreadsheetId: parsedInput.params.spreadsheetId,
          requestId,
          instance,
        })
      : problemNotFound(requestId, "Spreadsheets", parsedInput.params.type, instance),
});
