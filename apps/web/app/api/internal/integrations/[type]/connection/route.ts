import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { problemNotFound } from "@/app/api/v3/lib/response";
import { getGoogleSheetsConnectionOperation } from "../../lib/operations";
import { ZIntegrationParams, ZIntegrationWorkspaceQuery } from "../../schemas";

/** `GET /api/internal/integrations/googleSheets/connection?workspaceId=`: does the stored grant work? */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZIntegrationParams, query: ZIntegrationWorkspaceQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    parsedInput.params.type === "googleSheets"
      ? getGoogleSheetsConnectionOperation({
          authentication,
          workspaceId: parsedInput.query.workspaceId,
          requestId,
          instance,
        })
      : problemNotFound(requestId, "Connection check", parsedInput.params.type, instance),
});
