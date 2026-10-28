import "server-only";
import { InvalidInputError } from "@formbricks/types/errors";
import { requireOrgActionAccess } from "@/app/api/internal/lib/organization-access";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import {
  createdResponse,
  noContentResponse,
  problemConflict,
  problemForbidden,
  problemUnauthorized,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { can } from "@/lib/authorization";
import { getTeam } from "@/lib/utils/services";
import { requireRoleManagementEntitlement } from "@/modules/ee/role-management/lib/api-access";
import { getTeamRoleByTeamIdUserId } from "@/modules/ee/teams/lib/roles";
import {
  createTeam,
  deleteTeam,
  getTeamDetails,
  updateTeamDetails,
} from "@/modules/ee/teams/team-list/lib/team";
import { hasWorkspaceAccessChanges } from "@/modules/ee/teams/team-list/lib/workspace-access";
import type { TTeamCreateBody, TTeamUpdateBody } from "../schemas";
import { serializeTeam } from "../serializers";

/**
 * Teams, for the organization's Teams settings page. Enterprise-gated: every operation checks the role
 * management licence after authorizing the caller, as the server actions it replaces did.
 */

type TRequestContext = {
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

export const TEAMS_BASE_PATH = "/api/internal/teams";

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
    if (error instanceof InvalidInputError) return problemConflict(requestId, error.message, instance);
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
 * `PATCH /api/internal/teams/{teamId}`: rename the team and replace its members and workspace grants.
 * Owners, managers and the team's admins; changing workspace grants is owners' and managers' only.
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

  await updateTeamDetails(teamId, body);
  const after = await getTeamDetails(teamId);
  if (!after) return problemForbidden(requestId, undefined, instance);

  if (auditLog) {
    auditLog.oldObject = before;
    auditLog.newObject = after;
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
