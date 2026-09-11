import "server-only";
import { OrganizationAccessType } from "@formbricks/types/api-key";
import { USER_MANAGEMENT_MINIMUM_ROLE } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags, getUserManagementAccess } from "@/lib/membership/utils";
import { getTeamRoleByTeamIdUserId } from "@/modules/ee/teams/lib/roles";
import {
  AUTHORIZATION_PERMISSION_MAP,
  type TAuthorizationAction,
  type TAuthorizationActor,
  type TAuthorizationResourceForAction,
  type TAuthorizationResourceType,
} from "./contract";
import type { AuthorizationEvaluator } from "./evaluator";
import {
  hasApiKeyOrganizationAccessLegacy,
  hasApiKeyWorkspacePermissionLegacy,
} from "./legacy-api-key-access";
import { type LegacyWorkspaceAction, hasUserWorkspaceAccessForActionLegacy } from "./legacy-workspace-access";
import {
  getApiKeyAuthById,
  getApiKeyOrganizationId,
  getDashboardWorkspaceId,
  getFeedbackDirectoryAssignmentAuthorizationScope,
  getFeedbackDirectoryAuthorizationScope,
  getResponseSurveyId,
  getSurveyWorkspaceId,
  getTeamOrganizationId,
} from "./resolvers";

/**
 * The Phase-0 authorization evaluator. It reproduces the authorization behavior
 * Formbricks enforces today by delegating to the existing org/workspace/team/
 * API-key helpers — it does not reimplement the rules, so it stays in lockstep
 * with current behavior and with the `./contract` vocabulary (and the
 * `authzed/schema.zed` mirror the future SpiceDB evaluator implements).
 *
 * Operational failures (DB errors) raised by the helpers/resolvers propagate;
 * only a genuine "no matching grant" (or a missing resource) resolves to
 * `false`. It never translates an error into a denial.
 */

/** Split a dotted action (e.g. `"survey.response_export"`) into its parts. */
const parseAction = (
  action: TAuthorizationAction
): { resourceType: TAuthorizationResourceType; permission: string } => {
  const separator = action.indexOf(".");
  return {
    resourceType: action.slice(0, separator) as TAuthorizationResourceType,
    permission: action.slice(separator + 1),
  };
};

const FEEDBACK_DIRECTORY_WORKSPACE_ACTION = {
  manage: "workspace.manage",
  read: "workspace.read",
  write: "workspace.write",
} as const;

type TFeedbackDirectoryPermission = keyof typeof FEEDBACK_DIRECTORY_WORKSPACE_ACTION;

const FEEDBACK_DIRECTORY_WORKSPACE_CHECK_CONCURRENCY = 10;

const canAccessAnyWorkspace = async (
  workspaceIds: ReadonlyArray<string>,
  checkAccess: (workspaceId: string) => Promise<boolean>
): Promise<boolean> => {
  for (let index = 0; index < workspaceIds.length; index += FEEDBACK_DIRECTORY_WORKSPACE_CHECK_CONCURRENCY) {
    const decisions = await Promise.all(
      workspaceIds
        .slice(index, index + FEEDBACK_DIRECTORY_WORKSPACE_CHECK_CONCURRENCY)
        .map((workspaceId) => checkAccess(workspaceId))
    );
    if (decisions.some(Boolean)) return true;
  }

  return false;
};

const canFeedbackDirectory = async (
  actor: TAuthorizationActor,
  permission: TFeedbackDirectoryPermission,
  feedbackDirectoryId: string
): Promise<boolean> => {
  const scope = await getFeedbackDirectoryAuthorizationScope(feedbackDirectoryId);
  if (!scope || scope.isArchived) return false;
  if (await canOrganization(actor, "manage", scope.organizationId)) return true;

  const workspaceAction = FEEDBACK_DIRECTORY_WORKSPACE_ACTION[permission];
  return canAccessAnyWorkspace(scope.workspaceIds, (workspaceId) =>
    canWorkspaceScoped(actor, workspaceAction, workspaceId)
  );
};

const canFeedbackDirectoryAssignment = async (
  actor: TAuthorizationActor,
  permission: TFeedbackDirectoryPermission,
  feedbackDirectoryId: string,
  workspaceId: string
): Promise<boolean> => {
  const scope = await getFeedbackDirectoryAssignmentAuthorizationScope(feedbackDirectoryId, workspaceId);
  if (!scope) return false;
  if (await canOrganization(actor, "manage", scope.organizationId)) return true;

  return canWorkspaceScoped(actor, FEEDBACK_DIRECTORY_WORKSPACE_ACTION[permission], workspaceId);
};

/**
 * Exhaustiveness guard for the actor discriminated union: an unknown or future
 * principal type is rejected outright — never implicitly treated as an API key.
 * Adding a new actor type to `TAuthorizationActor` makes every call site that
 * doesn't handle it a compile error.
 */
const rejectUnknownActor = (actor: never): never => {
  throw new Error(`Unsupported authorization actor type: ${(actor as { type: string }).type}`);
};

/** Workspace permission level required by each workspace-derived action (mirrors the contract). */
const WORKSPACE_ACTION_LEVEL: Partial<Record<TAuthorizationAction, LegacyWorkspaceAction>> = {
  // read level → GET
  "workspace.read": "GET",
  "survey.read": "GET",
  "survey.response_read": "GET",
  "survey.response_export": "GET", // export shares the read gate today
  "dashboard.read": "GET",
  "response.read": "GET",
  "response.export": "GET",
  // readWrite level → POST
  "workspace.write": "POST",
  "survey.write": "POST",
  "survey.delete": "POST", // survey delete uses the readWrite gate today
  "survey.publish": "POST",
  "dashboard.write": "POST",
  "response.write": "POST",
  // manage level → DELETE
  "workspace.manage": "DELETE",
  "workspace.share": "DELETE",
  "survey.manage": "DELETE",
  "response.manage": "DELETE",
};

/** Resolve access for a workspace or any workspace-derived resource (survey/dashboard/response). */
const canWorkspaceScoped = async (
  actor: TAuthorizationActor,
  action: TAuthorizationAction,
  workspaceId: string
): Promise<boolean> => {
  const method = WORKSPACE_ACTION_LEVEL[action];
  if (!method) return false;

  if (actor.type === "user") {
    return hasUserWorkspaceAccessForActionLegacy(actor.id, workspaceId, method);
  }

  if (actor.type === "apiKey") {
    const auth = await getApiKeyAuthById(actor.id);
    if (!auth) return false;
    return hasApiKeyWorkspacePermissionLegacy(auth.workspacePermissions, workspaceId, method);
  }

  return rejectUnknownActor(actor);
};

const canOrganization = async (
  actor: TAuthorizationActor,
  permission: string,
  organizationId: string
): Promise<boolean> => {
  if (actor.type === "user") {
    const membership = await getMembershipByUserIdOrganizationId(actor.id, organizationId);
    const { isOwner, isManager, isMember, isBilling } = getAccessFlags(membership?.role);

    switch (permission) {
      case "read":
        return membership !== null; // any membership can see the organization exists
      case "write":
        return isOwner; // update/delete the organization entity: owner only
      case "manage":
        return isOwner || isManager; // full product access across workspaces
      case "manage_billing":
        return isOwner || isManager || isBilling; // billing role reaches billing surfaces
      case "read_access":
        return isOwner || isManager || isMember; // see teams/members; billing excluded
      case "manage_access":
        // Member/role/invite management honors the deployment's configurable
        // USER_MANAGEMENT_MINIMUM_ROLE floor (owner | manager | disabled), exactly
        // as the current app does — not a hardcoded owner/manager check.
        return membership !== null && getUserManagementAccess(membership.role, USER_MANAGEMENT_MINIMUM_ROLE);
      case "manage_api_keys":
        return isOwner || isManager;
      default:
        return false;
    }
  }

  if (actor.type === "apiKey") {
    const auth = await getApiKeyAuthById(actor.id);
    if (!auth) return false;
    if (auth.organizationId !== organizationId) return false;

    switch (permission) {
      case "read":
      case "read_access":
        return hasApiKeyOrganizationAccessLegacy(auth, OrganizationAccessType.Read);
      case "manage_access":
        return hasApiKeyOrganizationAccessLegacy(auth, OrganizationAccessType.Write);
      default:
        // write / manage / manage_billing / manage_api_keys are user-only today.
        return false;
    }
  }

  return rejectUnknownActor(actor);
};

const canTeam = async (actor: TAuthorizationActor, permission: string, teamId: string): Promise<boolean> => {
  const organizationId = await getTeamOrganizationId(teamId);
  if (!organizationId) return false;

  if (actor.type === "user") {
    const membership = await getMembershipByUserIdOrganizationId(actor.id, organizationId);
    const { isOwner, isManager, isMember } = getAccessFlags(membership?.role);
    const hasOrgReadAccess = isOwner || isManager || isMember;
    const hasOrgManageAccess = isOwner || isManager;
    const teamRole = await getTeamRoleByTeamIdUserId(teamId, actor.id);

    switch (permission) {
      case "read":
        return teamRole !== null || hasOrgReadAccess;
      case "manage":
        return teamRole === "admin" || hasOrgManageAccess;
      case "delete":
        return hasOrgManageAccess; // team deletion is org owners/managers only
      default:
        return false;
    }
  }

  if (actor.type === "apiKey") {
    const auth = await getApiKeyAuthById(actor.id);
    if (!auth) return false;
    if (auth.organizationId !== organizationId) return false;

    switch (permission) {
      case "read":
        return hasApiKeyOrganizationAccessLegacy(auth, OrganizationAccessType.Read);
      case "manage":
      case "delete":
        return hasApiKeyOrganizationAccessLegacy(auth, OrganizationAccessType.Write);
      default:
        return false;
    }
  }

  return rejectUnknownActor(actor);
};

/** Reading or managing an API key is limited to organization owners/managers (users only). */
const canApiKeyResource = async (actor: TAuthorizationActor, apiKeyId: string): Promise<boolean> => {
  // API-key management is user-only, so an API-key principal is explicitly denied
  // (not an error — it's a legitimate actor that simply lacks this capability).
  if (actor.type === "apiKey") return false;

  if (actor.type === "user") {
    const organizationId = await getApiKeyOrganizationId(apiKeyId);
    if (!organizationId) return false;

    const membership = await getMembershipByUserIdOrganizationId(actor.id, organizationId);
    const { isOwner, isManager } = getAccessFlags(membership?.role);
    return isOwner || isManager;
  }

  return rejectUnknownActor(actor);
};

export const legacyEvaluator: AuthorizationEvaluator = {
  async can<TAction extends TAuthorizationAction>(
    actor: TAuthorizationActor,
    action: TAction,
    resource: TAuthorizationResourceForAction<NoInfer<TAction>>
  ): Promise<boolean> {
    const { resourceType, permission } = parseAction(action);

    // Defense in depth: the contract ties the action to the resource type at
    // compile time, but if a caller bypasses the types the action must never be
    // dispatched against a mismatched resource. This is caller misuse, not an
    // authorization denial, so it propagates rather than resolving to `false`.
    if (resourceType !== resource.type) {
      throw new Error(`Authorization action "${action}" does not match resource type "${resource.type}"`);
    }

    // Reject any action outside the current vocabulary before dispatch — defense
    // against a type-bypassed or not-yet-implemented action (e.g. a bogus
    // `apiKey.delete`) reaching an evaluator that would otherwise grant it.
    if (!(AUTHORIZATION_PERMISSION_MAP[resourceType] as readonly string[]).includes(permission)) {
      throw new Error(`Unknown authorization action "${action}"`);
    }

    switch (resource.type) {
      case "organization":
        return canOrganization(actor, permission, resource.id);
      case "team":
        return canTeam(actor, permission, resource.id);
      case "apiKey":
        return canApiKeyResource(actor, resource.id);
      case "workspace":
        return canWorkspaceScoped(actor, action, resource.id);
      case "survey": {
        const workspaceId = await getSurveyWorkspaceId(resource.id);
        return workspaceId ? canWorkspaceScoped(actor, action, workspaceId) : false;
      }
      case "dashboard": {
        const workspaceId = await getDashboardWorkspaceId(resource.id);
        return workspaceId ? canWorkspaceScoped(actor, action, workspaceId) : false;
      }
      case "response": {
        const surveyId = await getResponseSurveyId(resource.id);
        if (!surveyId) return false;
        const workspaceId = await getSurveyWorkspaceId(surveyId);
        return workspaceId ? canWorkspaceScoped(actor, action, workspaceId) : false;
      }
      case "feedbackDirectory":
        return canFeedbackDirectory(actor, permission as "manage" | "read" | "write", resource.id);
      case "feedbackDirectoryAssignment":
        return canFeedbackDirectoryAssignment(
          actor,
          permission as "manage" | "read" | "write",
          resource.feedbackDirectoryId,
          resource.workspaceId
        );
      default:
        return false;
    }
  },
};
