import "server-only";
import { logger } from "@formbricks/logger";
import { InvalidInputError } from "@formbricks/types/errors";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { parseV3Body } from "@/app/api/v3/lib/parse-body";
import {
  createdResponse,
  problemConflict,
  problemForbidden,
  problemUnprocessableContent,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { problemHiddenResource, requireV3OrganizationManager } from "@/app/api/v3/organizations/lib/access";
import { rejectEmptyChange } from "@/app/api/v3/workspaces/lib/setup-input";
import { can } from "@/lib/authorization";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  createTeam,
  deleteTeam,
  getTeamDetails,
  updateTeamDetails,
} from "@/modules/ee/teams/team-list/lib/team";
import { hasWorkspaceAccessChanges } from "@/modules/ee/teams/team-list/lib/workspace-access";
import type { TTeamDetails, TTeamRole } from "@/modules/ee/teams/team-list/types/team";
import { getTeamDirectory } from "@/modules/shell/organization/lib/team-directory";
import {
  TEAM_ADMIN_SELF_MESSAGE,
  TEAM_WORKSPACE_ACCESS_MESSAGE,
  requireTeamsLicence,
  requireTeamsUser,
} from "./access";
import {
  countOrganizationTeams,
  countOrganizationWorkspaces,
  getOrganizationRoles,
  isTeamNameTaken,
} from "./data";
import { type TTeamState, diffTeam, hasTeamChanges, lowersTeamAccess } from "./diff";
import {
  type TV3TeamDeleteResource,
  type TV3TeamListItem,
  type TV3TeamResource,
  type TV3TeamUpdateResource,
  ZV3TeamCreateBody,
  ZV3TeamUpdateBody,
} from "./schemas";

type TTeamOperationParams = {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
};

/** The most teams one list answers with, the cap the retired Teams page had. */
export const V3_TEAM_LIST_LIMIT = 200;

export const TEAM_NAME_TAKEN_MESSAGE = "A team with this name already exists in the organization.";
export const TEAM_UPDATE_PREVIEW_MESSAGE =
  "Not changed. This takes access away from people or workspaces. Call again with confirm: true after the person approves.";
export const TEAM_DELETE_PREVIEW_MESSAGE =
  "Not deleted. Its members lose the workspace access this team gave them. Call again with confirm: true after the person approves.";

const serializeTeam = (team: TTeamDetails): TV3TeamResource => ({
  id: team.id,
  name: team.name,
  organizationId: team.organizationId,
  members: team.members,
  workspaces: team.workspaces,
});

const toState = (team: TTeamDetails): TTeamState => ({
  name: team.name,
  members: team.members.map(({ userId, role }) => ({ userId, role })),
  workspaces: team.workspaces.map(({ workspaceId, permission }) => ({ workspaceId, permission })),
});

const invalidParams = (requestId: string, instance: string, name: string, reason: string): Response =>
  problemUnprocessableContent(requestId, reason, { invalid_params: [{ name, reason }], instance });

/**
 * List an organization's teams: id, name, member count, the caller's own role in each, and, for owners and
 * managers only, which workspaces each team reaches. Any organization member except the billing role may
 * read it. At most `V3_TEAM_LIST_LIMIT` teams; `meta.totalCount` says when more exist.
 */
export async function listV3Teams({
  organizationId,
  authentication,
  requestId,
  instance,
}: TTeamOperationParams & { organizationId: string }): Promise<Response> {
  const log = logger.withContext({ requestId, organizationId });

  try {
    const user = requireTeamsUser(authentication, requestId, instance);
    if (user instanceof Response) return user;

    const actor = { type: "user", id: user.userId } as const;
    const canRead = await can(actor, "organization.read_access", {
      type: "organization",
      id: organizationId,
    });
    if (!canRead) return problemHiddenResource(requestId, instance);

    const [licence, isManager] = await Promise.all([
      requireTeamsLicence(organizationId, requestId, instance),
      can(actor, "organization.manage", { type: "organization", id: organizationId }),
    ]);
    if (licence) return licence;

    const [directory, totalCount] = await Promise.all([
      getTeamDirectory(organizationId, user.userId, isManager),
      countOrganizationTeams(organizationId),
    ]);

    const teams: TV3TeamListItem[] = directory.map((team) => ({
      id: team.id,
      name: team.name,
      memberCount: team.memberCount,
      viewerRole: team.viewerRole,
      workspaces: team.access,
    }));

    return successListResponse(
      teams,
      { limit: V3_TEAM_LIST_LIMIT, nextCursor: null, totalCount, totalCountRelation: "eq" },
      { requestId, cache: "private, no-store" }
    );
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "teams.list" });
  }
}

/** Read one team with its members and workspace access. Organization owners and managers and the team's own admins. */
export async function getV3Team({
  teamId,
  authentication,
  requestId,
  instance,
}: TTeamOperationParams & { teamId: string }): Promise<Response> {
  const log = logger.withContext({ requestId, teamId });

  try {
    const user = requireTeamsUser(authentication, requestId, instance);
    if (user instanceof Response) return user;

    const allowed = await can({ type: "user", id: user.userId }, "team.manage", { type: "team", id: teamId });
    if (!allowed) return problemHiddenResource(requestId, instance);

    const team = await getTeamDetails(teamId);
    if (!team) return problemHiddenResource(requestId, instance);

    const licence = await requireTeamsLicence(team.organizationId, requestId, instance);
    if (licence) return licence;

    return successResponse(serializeTeam(team), { requestId, cache: "private, no-store" });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "teams.get" });
  }
}

/** Create an empty team. Organization owners and managers; the team has no members and no workspace access yet. */
export async function createV3Team({
  organizationId,
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: TTeamOperationParams & { organizationId: string; body: unknown }): Promise<Response> {
  const log = logger.withContext({ requestId, organizationId });

  try {
    const parsed = parseV3Body(ZV3TeamCreateBody, body, requestId, instance);
    if (!parsed.ok) return parsed.response;

    const access = await requireV3OrganizationManager(authentication, organizationId, requestId, instance);
    if (access instanceof Response) {
      log.warn({ statusCode: 403 }, "Team creation refused for this principal");
      return access;
    }

    if (auditLog) auditLog.organizationId = organizationId;

    const licence = await requireTeamsLicence(organizationId, requestId, instance);
    if (licence) return licence;

    await applyRateLimit(rateLimitConfigs.actions.stateMutation, organizationId);

    let teamId: string;
    try {
      teamId = await createTeam(organizationId, parsed.data.name);
    } catch (error) {
      // `createTeam`'s one InvalidInputError is the duplicate name; the unique index backs it up.
      if (error instanceof InvalidInputError) {
        return problemConflict(requestId, TEAM_NAME_TAKEN_MESSAGE, instance);
      }
      throw error;
    }

    const team = await getTeamDetails(teamId);
    if (!team) return problemHiddenResource(requestId, instance);

    if (auditLog) {
      auditLog.targetId = teamId;
      auditLog.newObject = team;
    }

    log.info({ statusCode: 201, teamId }, "Team created");
    return createdResponse(serializeTeam(team), {
      location: `/api/v3/teams/${teamId}`,
      requestId,
      cache: "private, no-store",
    });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "teams.create" });
  }
}

type TUpdateParams = TTeamOperationParams & { teamId: string; body: unknown };

/**
 * The state `update_team` asks for: the stored team with the given name, member list and workspace access
 * laid over it. Returns the `Response` to relay when the request names someone outside the organization,
 * contradicts the owner/manager-are-admins rule, or names a workspace of another organization.
 */
async function resolveRequestedState(
  current: TTeamDetails,
  requested: {
    name?: string;
    members?: { userId: string; role?: TTeamRole }[];
    workspaces?: TTeamState["workspaces"];
  },
  requestId: string,
  instance: string
): Promise<Response | TTeamState> {
  const next = toState(current);
  if (requested.name !== undefined) next.name = requested.name;

  if (requested.members) {
    const roles = await getOrganizationRoles(
      current.organizationId,
      requested.members.map((member) => member.userId)
    );
    const currentRoles = new Map(next.members.map((member) => [member.userId, member.role]));

    const members: TTeamState["members"] = [];
    for (const { userId, role } of requested.members) {
      const organizationRole = roles.get(userId);
      if (!organizationRole) {
        return invalidParams(
          requestId,
          instance,
          "members",
          "A person in the list is not a member of this organization."
        );
      }

      // Owners and managers administer every team they are in, as the retired form enforced.
      const administersEverything = organizationRole === "owner" || organizationRole === "manager";
      if (administersEverything && role === "contributor") {
        return invalidParams(
          requestId,
          instance,
          "members",
          "Organization owners and managers are always team admins; they cannot be contributors."
        );
      }
      members.push({
        userId,
        role: role ?? (administersEverything ? "admin" : (currentRoles.get(userId) ?? "contributor")),
      });
    }
    next.members = members;
  }

  if (requested.workspaces) {
    const known = await countOrganizationWorkspaces(
      current.organizationId,
      requested.workspaces.map((grant) => grant.workspaceId)
    );
    if (known !== requested.workspaces.length) {
      return invalidParams(
        requestId,
        instance,
        "workspaces",
        "A workspace in the list does not belong to this organization."
      );
    }
    next.workspaces = requested.workspaces;
  }

  return next;
}

/**
 * Change a team's name, members and workspace access. `members` and `workspaces`, when given, are the
 * complete new lists. Allowed for organization owners and managers, and for the team's own admins, who may
 * edit the name and members but not the workspace access, and may not remove themselves or change their own
 * team role (the rules of the form this replaced). A change that takes access away is previewed unless
 * `confirm` is true, so a model cannot cut someone off on its own say-so.
 */
export async function updateV3Team({
  teamId,
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: TUpdateParams): Promise<Response> {
  const log = logger.withContext({ requestId, teamId });

  try {
    const parsed = parseV3Body(ZV3TeamUpdateBody, body, requestId, instance);
    if (!parsed.ok) return parsed.response;
    const { confirm, name, members, workspaces } = parsed.data;
    const empty = rejectEmptyChange({ name, members, workspaces }, requestId, instance);
    if (empty) return empty;

    const user = requireTeamsUser(authentication, requestId, instance);
    if (user instanceof Response) return user;
    const actor = { type: "user", id: user.userId } as const;

    const allowed = await can(actor, "team.manage", { type: "team", id: teamId });
    if (!allowed) {
      log.warn({ statusCode: 403 }, "Team update refused for this principal");
      return problemHiddenResource(requestId, instance);
    }

    const current = await getTeamDetails(teamId);
    if (!current) return problemHiddenResource(requestId, instance);
    const { organizationId } = current;

    if (auditLog) {
      auditLog.organizationId = organizationId;
      auditLog.targetId = teamId;
    }

    const licence = await requireTeamsLicence(organizationId, requestId, instance);
    if (licence) return licence;

    const isManager = await can(actor, "organization.manage", { type: "organization", id: organizationId });

    // A team admin may be a plain organization member, and `workspaces` is the team's whole grant list:
    // without this gate they could grant their own team `manage` on every workspace of the organization.
    if (!isManager && workspaces && hasWorkspaceAccessChanges(current.workspaces, workspaces)) {
      return problemForbidden(requestId, TEAM_WORKSPACE_ACCESS_MESSAGE, instance);
    }

    const next = await resolveRequestedState(current, { name, members, workspaces }, requestId, instance);
    if (next instanceof Response) return next;

    if (!isManager && members) {
      const before = current.members.find((member) => member.userId === user.userId);
      const after = next.members.find((member) => member.userId === user.userId);
      if (before && before.role !== after?.role) {
        return problemForbidden(requestId, TEAM_ADMIN_SELF_MESSAGE, instance);
      }
    }

    const changes = diffTeam(toState(current), next);
    if (!hasTeamChanges(changes)) {
      skipV3AuditLog(auditLog);
      const unchanged: TV3TeamUpdateResource = {
        status: "unchanged",
        changes,
        team: serializeTeam(current),
        message: "Nothing to change: the team already matches this request.",
      };
      return successResponse(unchanged, { requestId, cache: "private, no-store" });
    }

    if (changes.name && (await isTeamNameTaken(organizationId, next.name, teamId))) {
      return problemConflict(requestId, TEAM_NAME_TAKEN_MESSAGE, instance);
    }

    if (lowersTeamAccess(changes) && confirm !== true) {
      // A preview changes nothing, so there is nothing to audit.
      skipV3AuditLog(auditLog);
      const preview: TV3TeamUpdateResource = {
        status: "preview",
        changes,
        team: serializeTeam(current),
        message: TEAM_UPDATE_PREVIEW_MESSAGE,
      };
      return successResponse(preview, { requestId, cache: "private, no-store" });
    }

    await applyRateLimit(rateLimitConfigs.actions.stateMutation, organizationId);
    await updateTeamDetails(teamId, next);

    const updated = await getTeamDetails(teamId);
    if (!updated) return problemHiddenResource(requestId, instance);

    if (auditLog) {
      auditLog.oldObject = current;
      auditLog.newObject = updated;
    }

    const resource: TV3TeamUpdateResource = {
      status: "updated",
      changes,
      team: serializeTeam(updated),
      message: "Team updated.",
    };
    log.info({ statusCode: 200 }, "Team updated");
    return successResponse(resource, { requestId, cache: "private, no-store" });
  } catch (error) {
    if (error instanceof InvalidInputError) {
      // `updateTeamDetails`' own membership and workspace checks, a backstop to the ones above.
      return invalidParams(
        requestId,
        instance,
        "body",
        "The members or workspaces do not belong to this organization."
      );
    }
    return mapV3ThrownError(error, { log, requestId, instance, operation: "teams.update" });
  }
}

/**
 * Delete a team. Organization owners and managers (`team.delete`). **Nothing is deleted unless `confirm` is
 * `true`**: without it the call runs every check and answers with a `preview`, so a model cannot delete a
 * team on its own say-so. Members keep their organization role; they lose the workspace access the team gave.
 */
export async function deleteV3Team({
  teamId,
  confirm,
  authentication,
  requestId,
  instance,
  auditLog,
}: TTeamOperationParams & { teamId: string; confirm?: boolean }): Promise<Response> {
  const log = logger.withContext({ requestId, teamId });

  try {
    const user = requireTeamsUser(authentication, requestId, instance);
    if (user instanceof Response) return user;

    const allowed = await can({ type: "user", id: user.userId }, "team.delete", { type: "team", id: teamId });
    if (!allowed) {
      log.warn({ statusCode: 403 }, "Team delete refused for this principal");
      return problemHiddenResource(requestId, instance);
    }

    const team = await getTeamDetails(teamId);
    if (!team) return problemHiddenResource(requestId, instance);

    if (auditLog) {
      auditLog.organizationId = team.organizationId;
      auditLog.targetId = teamId;
    }

    const licence = await requireTeamsLicence(team.organizationId, requestId, instance);
    if (licence) return licence;

    const summary = {
      id: team.id,
      organizationId: team.organizationId,
      name: team.name,
      memberCount: team.members.length,
      workspaceCount: team.workspaces.length,
    };

    if (confirm !== true) {
      skipV3AuditLog(auditLog);
      const preview: TV3TeamDeleteResource = {
        status: "preview",
        ...summary,
        message: TEAM_DELETE_PREVIEW_MESSAGE,
      };
      return successResponse(preview, { requestId, cache: "private, no-store" });
    }

    await applyRateLimit(rateLimitConfigs.actions.stateMutation, team.organizationId);
    await deleteTeam(teamId);

    if (auditLog) auditLog.oldObject = team;

    const deleted: TV3TeamDeleteResource = { status: "deleted", ...summary, message: "Team deleted." };
    log.info({ statusCode: 200 }, "Team deleted");
    return successResponse(deleted, { requestId, cache: "private, no-store" });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "teams.delete" });
  }
}
