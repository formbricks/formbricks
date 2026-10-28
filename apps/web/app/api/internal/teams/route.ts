import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listTeamsOperation } from "./lib/operations";
import { ZTeamsQuery } from "./schemas";

/** `GET /api/internal/teams?organizationId=`: the organization's teams, for the create-workspace dialog. */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZTeamsQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listTeamsOperation({
      authentication,
      organizationId: parsedInput.query.organizationId,
      requestId,
      instance,
    }),
});
