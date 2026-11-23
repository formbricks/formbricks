/**
 * GET /api/v3/teams/{teamId}/dashboard-limits — the dashboards the team's Dashboard Viewer members open
 *     in the team's workspaces; an empty list means all of them.
 * PUT /api/v3/teams/{teamId}/dashboard-limits — replace them. Audited on the team.
 *
 * Access Control read / write (an Owner or Manager session, or an API key of the team's organization);
 * Access Control and Dashboards on the plan. A team of another organization, or none, answers 403.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { getV3TeamDashboardLimits, replaceV3TeamDashboardLimits } from "../../lib/operations";
import { ZV3TeamDashboardLimitsBody, ZV3TeamParams } from "../../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZV3TeamParams, query: ZV3EmptyQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3TeamDashboardLimits({ authentication, teamId: parsedInput.params.teamId, requestId, instance }),
});

export const PUT = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "team",
  schemas: { params: ZV3TeamParams, query: ZV3EmptyQuery, body: ZV3TeamDashboardLimitsBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    replaceV3TeamDashboardLimits({
      authentication,
      teamId: parsedInput.params.teamId,
      body: parsedInput.body,
      auditLog,
      requestId,
      instance,
    }),
});
