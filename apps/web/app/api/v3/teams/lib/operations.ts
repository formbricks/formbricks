import "server-only";
import { requireV3OrganizationAccess } from "@/app/api/v3/lib/organization-access";
import {
  problemDashboardAccessPlanRequired,
  problemForbidden,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import {
  TeamDashboardLimitsInvalidError,
  getTeamDashboardLimits,
  getTeamOrganizationId,
  replaceTeamDashboardLimits,
} from "@/modules/ee/dashboard-access/lib/team-dashboard-limits";
import { getIsDashboardViewerRoleEnabled } from "@/modules/ee/license-check/lib/utils";
import type { TV3TeamDashboardLimitsBody } from "./schemas";

/**
 * A team's dashboard limits (ENG-7483), for the v3 routes and the MCP read tool. Read: an Owner or
 * Manager session, or an API key with Access Control read. Write: Owners and Managers, or an API key with
 * Access Control write. Both need Access Control and Dashboards. A team of another organization, or none,
 * answers the same 403.
 */

type TParams = {
  authentication: TV3Authentication;
  teamId: string;
  requestId: string;
  instance?: string;
};

const FORBIDDEN_DETAIL = "You are not authorized to access this resource";

const authorize = async (
  { authentication, teamId, requestId, instance }: TParams,
  level: "read" | "write"
): Promise<Response | { organizationId: string }> => {
  const organizationId = await getTeamOrganizationId(teamId);
  if (!organizationId) return problemForbidden(requestId, FORBIDDEN_DETAIL, instance);
  const access = await requireV3OrganizationAccess(
    authentication,
    organizationId,
    level,
    requestId,
    instance
  );
  if (access instanceof Response) return access;
  if (!(await getIsDashboardViewerRoleEnabled(organizationId))) {
    return problemDashboardAccessPlanRequired(requestId, instance);
  }
  return access;
};

export async function getV3TeamDashboardLimits(params: TParams): Promise<Response> {
  const access = await authorize(params, "read");
  if (access instanceof Response) return access;
  const limits = await getTeamDashboardLimits(access.organizationId, params.teamId);
  if (!limits) return problemForbidden(params.requestId, FORBIDDEN_DETAIL, params.instance);
  return successResponse(limits, { requestId: params.requestId });
}

export async function replaceV3TeamDashboardLimits(
  params: TParams & { body: TV3TeamDashboardLimitsBody; auditLog?: TV3AuditLog }
): Promise<Response> {
  const { requestId, instance, auditLog, body, teamId } = params;
  const access = await authorize(params, "write");
  if (access instanceof Response) return access;
  if (auditLog) {
    auditLog.organizationId = access.organizationId;
    auditLog.targetId = teamId;
  }

  try {
    const replaced = await replaceTeamDashboardLimits(access.organizationId, teamId, body.dashboardIds);
    if (!replaced) return problemForbidden(requestId, FORBIDDEN_DETAIL, instance);
    if (auditLog) {
      auditLog.oldObject = { dashboardLimits: replaced.before };
      auditLog.newObject = { dashboardLimits: replaced.after };
    }
    return successResponse(replaced.after, { requestId });
  } catch (error) {
    if (error instanceof TeamDashboardLimitsInvalidError) {
      return problemUnprocessableContent(requestId, error.message, {
        instance,
        invalid_params: error.dashboardIds.map((id) => ({
          name: "dashboardIds",
          reason: `${id} is not a dashboard in a workspace the team is granted`,
        })),
      });
    }
    throw error;
  }
}
