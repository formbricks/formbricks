import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createTeamOperation } from "./lib/operations";
import { ZTeamCreateBody, ZTeamsQuery } from "./schemas";

/** `POST /api/internal/teams?organizationId=`: create a team in the organization. Enterprise-gated. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZTeamsQuery, body: ZTeamCreateBody },
  action: "created",
  targetType: "team",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createTeamOperation({
      authentication,
      organizationId: parsedInput.query.organizationId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
