import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listRetentionRunsOperation } from "./lib/operations";
import { ZRetentionRunsListQuery } from "./schemas";

/**
 * `GET /api/internal/retention-runs?organizationId=&limit=&cursor=&includeEmpty=`: the Data retention
 * History tab. Internal (session-only, no OpenAPI entry), per ENG-3695. Reads aren't audited (ENG-3615).
 */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZRetentionRunsListQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listRetentionRunsOperation({ authentication, query: parsedInput.query, requestId, instance }),
});
