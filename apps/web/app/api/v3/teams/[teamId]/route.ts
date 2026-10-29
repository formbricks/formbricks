/**
 * GET /api/v3/teams/{teamId} — one team with its members and workspace access.
 * PATCH /api/v3/teams/{teamId} — change its name, members and workspace access.
 * DELETE /api/v3/teams/{teamId} — delete it.
 *
 * Session cookie only. Organization owners and managers, and for GET and PATCH the team's own admins. The
 * operations enforce that and the Enterprise licence themselves. A PATCH that takes access away, and every
 * DELETE, does nothing and answers a preview unless it carries `confirm: true` (in the body for PATCH, in
 * the query for DELETE).
 */
import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { deleteV3Team, getV3Team, updateV3Team } from "@/app/api/v3/teams/lib/operations";
import { ZV3TeamDeleteQuery, ZV3TeamIdParams } from "@/app/api/v3/teams/lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZV3TeamIdParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3Team({ teamId: parsedInput.params.teamId, authentication, requestId, instance }),
});

export const PATCH = withV3ApiWrapper({
  auth: "session",
  action: "updated",
  targetType: "team",
  schemas: {
    params: ZV3TeamIdParams,
    query: ZV3EmptyQuery,
    // Parsed by the operation, so the MCP tool that calls it directly gets the same 400.
    body: z.unknown(),
  },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    updateV3Team({
      teamId: parsedInput.params.teamId,
      body: parsedInput.body,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});

export const DELETE = withV3ApiWrapper({
  auth: "session",
  action: "deleted",
  targetType: "team",
  schemas: { params: ZV3TeamIdParams, query: ZV3TeamDeleteQuery },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    deleteV3Team({
      teamId: parsedInput.params.teamId,
      confirm: parsedInput.query.confirm,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});
