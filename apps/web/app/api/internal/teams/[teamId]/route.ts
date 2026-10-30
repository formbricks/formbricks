import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteTeamOperation, getTeamOperation, updateTeamOperation } from "../lib/operations";
import { ZTeamIdParams, ZTeamUpdateBody } from "../schemas";

/** `GET /api/internal/teams/{teamId}`: the team and the caller's role in it, for the team settings modal. */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZTeamIdParams },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getTeamOperation({ authentication, teamId: parsedInput.params.teamId, requestId, instance }),
});

/** `PATCH /api/internal/teams/{teamId}`: rename the team and replace its members and workspace grants. */
export const PATCH = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZTeamIdParams, body: ZTeamUpdateBody },
  action: "updated",
  targetType: "team",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateTeamOperation({
      authentication,
      teamId: parsedInput.params.teamId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});

/** `DELETE /api/internal/teams/{teamId}`: delete the team. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZTeamIdParams },
  action: "deleted",
  targetType: "team",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    deleteTeamOperation({
      authentication,
      teamId: parsedInput.params.teamId,
      requestId,
      instance,
      auditLog,
    }),
});
