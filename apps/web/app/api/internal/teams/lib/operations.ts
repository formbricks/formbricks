import "server-only";
import { requireOrgActionAccess } from "@/app/api/internal/lib/organization-access";
import type { TRequestContext } from "@/app/api/internal/lib/types";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import {
  createdResponse,
  noContentResponse,
  problemConflict,
  problemDashboardAccessPlanRequired,
  problemForbidden,
  problemUnauthorized,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import { can } from "@/lib/authorization";
import { getTeam } from "@/lib/utils/services";
import {
  type TTeamDashboardLimits,
  type TTeamDashboardLimitsChange,
  TeamDashboardLimitsInvalidError,
} from "@/modules/ee/dashboard-access/lib/team-dashboard-limits";
import { getIsDashboardViewerRoleEnabled } from "@/modules/ee/license-check/lib/utils";
import { requireRoleManagementEntitlement } from "@/modules/ee/role-management/lib/api-access";
import { getTeamRoleByTeamIdUserId } from "@/modules/ee/teams/lib/roles";
import {
  TeamAssignmentOutsideOrganizationError,
  TeamNameTakenError,
} from "@/modules/ee/teams/team-list/lib/errors";
import {
  createTeam,
  deleteTeam,
  getTeamDetails,
  getTeamsByOrganizationId,
  updateTeamDetails,
} from "@/modules/ee/teams/team-list/lib/team";
import { hasWorkspaceAccessChanges } from "@/modules/ee/teams/team-list/lib/workspace-access";
import type { TTeamCreateBody, TTeamUpdateBody } from "../schemas";
import { serializeTeam, serializeTeamOption } from "../serializers";

/**
 * Teams, for the organization's Teams settings page. Enterprise-gated: every operation checks the role
 * management licence after authorizing the caller, as the server actions it replaces did.
 */

export const TEAMS_BASE_PATH = "/api/internal/teams";

/** The organization already has a team by this name: 409, from a create or a rename alike. */
const teamNameTaken = (error: TeamNameTakenError, { requestId, instance }: TRequestContext) =>
  problemConflict(requestId, error.message, instance);

/**
 * Authorize `action` on one team, then the licence. The organization is read off the team, never taken
 * from the caller. A missing team gets the same 403 as one the caller can't see, and a write names its
 * target in the audit entry before any check can refuse it.
 */
async function requireTeamAccess(
  context: TRequestContext,
  teamId: string,
  action: "team.manage" | "team.delete"
): Promise<Response | { organizationId: string; userId: string }> {
  const { authentication, requestId, instance, auditLog } = context;
  if (auditLog) auditLog.targetId = teamId;

  const actor = getV3AuthorizationActor(authentication);
  if (actor?.type !== "user") return problemUnauthorized(requestId, "Session required", instance);

  const team = await getTeam(teamId);
  if (!team) return problemForbidden(requestId, undefined, instance);
  if (auditLog) auditLog.organizationId = team.organizationId;

  if (!(await can(actor, action, { type: "team", id: teamId }))) {
    return problemForbidden(requestId, undefined, instance);
  }

  const notEntitled = await requireRoleManagementEntitlement({
    organizationId: team.organizationId,
    requestId,
    instance,
  });
  if (notEntitled) return notEntitled;

  return { organizationId: team.organizationId, userId: actor.id };
}

/** `POST /api/internal/teams?organizationId=`: create an empty team. Owners and managers. */
export async function createTeamOperation({
  organizationId,
  body,
  ...context
}: TRequestContext & { organizationId: string; body: TTeamCreateBody }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  if (auditLog) auditLog.organizationId = organizationId;

  const access = await requireOrgActionAccess({
    ...context,
    organizationId,
    action: "organization.manage",
  });
  if (access instanceof Response) return access;

  const notEntitled = await requireRoleManagementEntitlement({ organizationId, requestId, instance });
  if (notEntitled) return notEntitled;

  let teamId: string;
  try {
    teamId = await createTeam(organizationId, body.name);
  } catch (error) {
    // The only refusal reachable past the schema: a team with this name already exists here.
    if (error instanceof TeamNameTakenError) return teamNameTaken(error, context);
    throw error;
  }

  const team = await getTeamDetails(teamId);
  if (!team) throw new Error("A team created in this request could not be read back");

  if (auditLog) {
    auditLog.targetId = teamId;
    auditLog.newObject = team;
  }
  return createdResponse(serializeTeam(team), { requestId, location: `${TEAMS_BASE_PATH}/${teamId}` });
}

/**
 * `GET /api/internal/teams/{teamId}`: the team, for its settings modal, with the caller's own role in it.
 * Owners, managers and the team's admins.
 */
export async function getTeamOperation({
  teamId,
  ...context
}: TRequestContext & { teamId: string }): Promise<Response> {
  const { requestId, instance } = context;
  const access = await requireTeamAccess(context, teamId, "team.manage");
  if (access instanceof Response) return access;

  const [team, currentUserRole] = await Promise.all([
    getTeamDetails(teamId),
    getTeamRoleByTeamIdUserId(teamId, access.userId),
  ]);
  if (!team) return problemForbidden(requestId, undefined, instance);

  return successResponse({ ...serializeTeam(team), currentUserRole }, { requestId });
}

/**
 * A dashboard limit sent with a team update is checked as `PUT /api/v3/teams/{teamId}/dashboard-limits`
 * checks it: Access Control write (`organization.manage_access`), then the Access Control and Dashboards
 * plan. The refusal, or `null` when allowed.
 */
async function authorizeDashboardLimitsUpdate(
  context: TRequestContext,
  organizationId: string
): Promise<Response | null> {
  const access = await requireOrgActionAccess({
    ...context,
    organizationId,
    action: "organization.manage_access",
  });
  if (access instanceof Response) return access;
  if (!(await getIsDashboardViewerRoleEnabled(organizationId))) {
    return problemDashboardAccessPlanRequired(context.requestId, context.instance);
  }
  return null;
}

/** The answer to a refused team update, or `undefined` for an error that is not a refusal. */
const updateRefusal = (error: unknown, context: TRequestContext): Response | undefined => {
  const { requestId, instance } = context;
  if (error instanceof TeamNameTakenError) return teamNameTaken(error, context);
  if (error instanceof TeamAssignmentOutsideOrganizationError) {
    return problemUnprocessableContent(requestId, error.message, {
      instance,
      invalid_params: [{ name: error.field, reason: error.message }],
    });
  }
  if (error instanceof TeamDashboardLimitsInvalidError) {
    return problemUnprocessableContent(requestId, error.message, {
      instance,
      invalid_params: error.dashboardIds.map((id) => ({
        name: "dashboardIds",
        reason: `${id} is not a dashboard in a workspace the team is granted`,
      })),
    });
  }
  return undefined;
};

/** The team for the audit entry, with its dashboard limit when the update wrote one. */
const withDashboardLimits = <T extends object>(team: T, limits: TTeamDashboardLimits | null | undefined) =>
  limits === undefined ? team : { ...team, dashboardLimits: limits };

/**
 * `PATCH /api/internal/teams/{teamId}`: rename the team and replace its members and workspace grants.
 * Owners, managers and the team's admins; changing workspace grants is owners' and managers' only. A name
 * another team of the organization has is a 409, as on create; a member or workspace from outside the
 * organization is a 422 naming the field.
 *
 * `dashboardIds` also replaces the team's dashboard limit in the same transaction, with the checks of
 * `PUT /api/v3/teams/{teamId}/dashboard-limits`: Access Control write (`organization.manage_access`) and
 * the Access Control and Dashboards plan; a dashboard outside the team's workspaces is a 422.
 */
export async function updateTeamOperation({
  teamId,
  body,
  ...context
}: TRequestContext & { teamId: string; body: TTeamUpdateBody }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  const access = await requireTeamAccess(context, teamId, "team.manage");
  if (access instanceof Response) return access;

  const before = await getTeamDetails(teamId);
  if (!before) return problemForbidden(requestId, undefined, instance);

  // A team admin may be a plain org `member`, and this body carries the team's full workspace grant list —
  // so without this gate they could grant their own team `manage` on every workspace in the organization.
  // Changing workspace access stays owner/manager-only, matching what the UI offers.
  if (hasWorkspaceAccessChanges(before.workspaces, body.workspaces)) {
    const orgAccess = await requireOrgActionAccess({
      ...context,
      organizationId: access.organizationId,
      action: "organization.manage",
    });
    if (orgAccess instanceof Response) return orgAccess;
  }

  const { dashboardIds, ...teamDetails } = body;
  if (dashboardIds !== undefined) {
    const refusal = await authorizeDashboardLimitsUpdate(context, access.organizationId);
    if (refusal) return refusal;
  }

  let limits: TTeamDashboardLimitsChange | null;
  try {
    ({ dashboardLimits: limits } = await updateTeamDetails(teamId, teamDetails, dashboardIds));
  } catch (error) {
    const refusal = updateRefusal(error, context);
    if (refusal) return refusal;
    throw error;
  }
  const after = await getTeamDetails(teamId);
  if (!after) return problemForbidden(requestId, undefined, instance);

  if (auditLog) {
    // A limit saved with the team is audited beside it, as the limits route audits it: as the save's
    // transaction found and left it.
    auditLog.oldObject = withDashboardLimits(before, limits?.before);
    auditLog.newObject = withDashboardLimits(after, limits?.after);
  }
  return successResponse(serializeTeam(after), { requestId });
}

/** `DELETE /api/internal/teams/{teamId}`: delete the team. Its members keep their organization roles. */
export async function deleteTeamOperation({
  teamId,
  ...context
}: TRequestContext & { teamId: string }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  const access = await requireTeamAccess(context, teamId, "team.delete");
  if (access instanceof Response) return access;

  const before = await getTeamDetails(teamId);
  if (!before) return problemForbidden(requestId, undefined, instance);

  await deleteTeam(teamId);
  if (auditLog) auditLog.oldObject = before;
  return noContentResponse({ requestId });
}

/**
 * `GET /api/internal/teams?organizationId=`: the organization's teams, for assigning a new workspace to
 * them. Owners and managers, who are the ones who can create a workspace.
 */
export async function listTeamsOperation({
  authentication,
  organizationId,
  requestId,
  instance,
}: Omit<TRequestContext, "auditLog"> & { organizationId: string }): Promise<Response> {
  const access = await requireOrgActionAccess({
    authentication,
    organizationId,
    action: "organization.manage",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  const notEntitled = await requireRoleManagementEntitlement({
    organizationId: access.organizationId,
    requestId,
    instance,
  });
  if (notEntitled) return notEntitled;

  const teams = (await getTeamsByOrganizationId(access.organizationId)) ?? [];
  return successResponse(teams.map(serializeTeamOption), { requestId });
}
