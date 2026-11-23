import "server-only";
import { logger } from "@formbricks/logger";
import { type TAuthzedPermissionCheck, getAuthzedClient } from "@/lib/authzed/client";
import { AUTHZED_MAX_BULK_CHECK_ITEMS } from "@/lib/authzed/constants";
import { assertAuthzedProjectionFreshness } from "@/lib/authzed/outbox-freshness";
import { MCP_REACH_PERMISSION } from "@/lib/authzed/relationship-map";
import { USER_MANAGEMENT_MINIMUM_ROLE } from "@/lib/constants";
import {
  type TAuthorizationMcpGrant,
  getMcpGrantForActor,
  recordMcpReachConfirmed,
  recordMcpReachDenied,
} from "./context";
import {
  AUTHORIZATION_PERMISSION_MAP,
  type TAuthorizationAction,
  type TAuthorizationActor,
  type TAuthorizationResourceForAction,
  type TAuthorizationResourceType,
} from "./contract";
import type { AuthorizationEvaluator } from "./evaluator";
import { isMcpReachMissingFromSchema, toMcpGrantSubject } from "./mcp-reach";
import { getSpicedbObjectType } from "./object-type";
import { isPermissionMissingFromSchema } from "./schema-drift";
import {
  type TPendingPrivateSurveyPolicy,
  type TResolvedAuthorizationScope,
  resolveAuthorizationScope,
  resolveAuthorizationUserBatch,
} from "./source-scope";

const parseAction = (
  action: TAuthorizationAction
): Readonly<{ permission: string; resourceType: TAuthorizationResourceType }> => {
  const separator = action.indexOf(".");
  return {
    permission: action.slice(separator + 1),
    resourceType: action.slice(0, separator) as TAuthorizationResourceType,
  };
};

/**
 * The workspace permission a survey, response, dashboard or page action is decided by whenever the
 * decision is made on the workspace node: always for dashboards and pages, and for surveys and responses
 * while survey visibility is not enforced (readiness marker off) or a change is pending.
 * `survey.change_visibility` is deliberately absent — it has no workspace equivalent.
 *
 * `dashboard.read` and `dashboardPage.read` are the workspace `read` here, which never admits a
 * Dashboard Viewer; the viewer's arm is the projected node, asked beside it (`PROJECTED_NODE_ACTIONS`).
 * `dashboard.manage_access` is `administer` (Owners and Managers), which is what `dashboard#manage_access`
 * resolves to, asked where it needs no projected edge.
 */
const WORKSPACE_PERMISSION_FOR_DERIVED_ACTION = {
  "dashboard.manage_access": "administer",
  "dashboard.read": "read",
  "dashboard.write": "write",
  "dashboardPage.read": "read",
  "response.export": "read",
  "response.manage": "manage",
  "response.read": "read",
  "response.write": "write",
  "survey.delete": "write",
  "survey.manage": "manage",
  "survey.publish": "write",
  "survey.read": "read",
  "survey.response_export": "read",
  "survey.response_read": "read",
  "survey.write": "write",
} as const satisfies Partial<Record<TAuthorizationAction, "administer" | "manage" | "read" | "write">>;

/**
 * ADR-0059: actions also asked of the dashboard's or page's own node, which holds the team dashboard
 * limits and page team limits a Dashboard Viewer is decided by. Either check allows. The workspace check
 * answers Owners, Managers, Members and API keys exactly as `dashboard#full_read` would, without depending
 * on the dashboard or page being projected yet, so a dashboard created a moment ago opens for its author;
 * the node check adds the viewers, and denies them until the projection lands (fail closed).
 */
const PROJECTED_NODE_ACTIONS = {
  "dashboard.read": "read",
  "dashboardPage.read": "read",
} as const satisfies Partial<Record<TAuthorizationAction, string>>;

/** A response action decided on its survey's node (ENG-3282): the survey permission it inherits. */
const SURVEY_PERMISSION_FOR_RESPONSE_ACTION = {
  "response.export": "response_export_v2",
  "response.manage": "manage_v2",
  "response.read": "response_read_v2",
  "response.write": "write_v2",
} as const satisfies Partial<Record<TAuthorizationAction, string>>;

const assertActionMatchesResource = (
  action: TAuthorizationAction,
  resourceType: TAuthorizationResourceType
): void => {
  const parsed = parseAction(action);
  if (
    parsed.resourceType !== resourceType ||
    !(AUTHORIZATION_PERMISSION_MAP[resourceType] as readonly string[]).includes(parsed.permission)
  ) {
    throw new Error(`Invalid authorization action/resource combination`);
  }
};

const getPermission = (
  actor: TAuthorizationActor,
  action: TAuthorizationAction,
  resourceType: TAuthorizationResourceType,
  permissionResourceType: TAuthorizationResourceType
): string | null => {
  if (actor.type === "user" && action === "organization.manage_access") {
    switch (USER_MANAGEMENT_MINIMUM_ROLE) {
      case "disabled":
        return null;
      case "owner":
        return "write";
      case "manager":
        return "manage_access";
    }
  }

  // `dashboard#manage_access` admits users only; an API key never changes who opens a page.
  if (actor.type === "apiKey" && action === "dashboard.manage_access") return null;

  if (permissionResourceType === "workspace" && resourceType !== "workspace") {
    // No workspace permission stands in for `survey.change_visibility`, so it is denied here; the
    // visibility endpoint refuses it earlier with `visibility_not_enabled` while the marker is off.
    return action in WORKSPACE_PERMISSION_FOR_DERIVED_ACTION
      ? WORKSPACE_PERMISSION_FOR_DERIVED_ACTION[
          action as keyof typeof WORKSPACE_PERMISSION_FOR_DERIVED_ACTION
        ]
      : null;
  }

  if (permissionResourceType === "survey" && resourceType === "response") {
    return SURVEY_PERMISSION_FOR_RESPONSE_ACTION[
      action as keyof typeof SURVEY_PERMISSION_FOR_RESPONSE_ACTION
    ];
  }

  const permission = parseAction(action).permission;
  return permissionResourceType === "survey" && permission !== "change_visibility"
    ? `${permission}_v2`
    : permission;
};

type TSpicedbCheck = Readonly<{
  permission: string;
  resource: Readonly<{ id: string; type: TAuthorizationResourceType }>;
}>;

/**
 * `survey.change_visibility` — `(owner & workspace->read) + workspace->administer` in the schema — for a
 * survey whose graph node holds no edges yet: the same rule, from PostgreSQL's `ownerId`. Whether the
 * organization is entitled to change visibility is the endpoint's own gate, as on the settled path.
 */
const getChangeVisibilityCheckFromFacts = (
  actor: TAuthorizationActor,
  workspaceId: string,
  ownerId: string | null
): TSpicedbCheck | null => {
  if (actor.type === "apiKey") return null;
  return {
    permission: ownerId !== null && ownerId === actor.id ? "read" : "administer",
    resource: { id: workspaceId, type: "workspace" },
  };
};

/**
 * The single check a survey the graph does not hold the current version of is decided by (ENG-3282,
 * contract §5 "fail closed while pending").
 *
 * - `survey.change_visibility` stays on the survey's own node, whose owner/administrator edges do not
 *   depend on which value is in flight — unless that node has never been projected (no edges at all),
 *   when it is decided from PostgreSQL facts by the same rule.
 * - the initial projection of a workspace-visible survey: the workspace ladder, like any
 *   workspace-visible survey.
 * - otherwise API keys: never, whichever way the change points (K-1);
 * - the owner: their workspace ladder for the action, which includes the administrators' arm;
 * - anyone else: organization owners and managers only (`workspace#administer`).
 */
const getPendingPrivateCheck = (
  actor: TAuthorizationActor,
  action: TAuthorizationAction,
  resourceType: TAuthorizationResourceType,
  workspaceId: string,
  policy: TPendingPrivateSurveyPolicy
): TSpicedbCheck | null => {
  if (action === "survey.change_visibility") {
    return policy.neverAcknowledged
      ? getChangeVisibilityCheckFromFacts(actor, workspaceId, policy.ownerId)
      : { permission: "change_visibility", resource: { id: policy.surveyId, type: "survey" } };
  }
  if (policy.kind === "initialShared") {
    const permission = getPermission(actor, action, resourceType, "workspace");
    return permission ? { permission, resource: { id: workspaceId, type: "workspace" } } : null;
  }
  if (actor.type === "apiKey") return null;

  const ladder =
    WORKSPACE_PERMISSION_FOR_DERIVED_ACTION[action as keyof typeof WORKSPACE_PERMISSION_FOR_DERIVED_ACTION];
  if (!ladder || ladder === "administer") return null;

  return {
    permission: policy.ownerId !== null && policy.ownerId === actor.id ? ladder : "administer",
    resource: { id: workspaceId, type: "workspace" },
  };
};

const getCheck = (
  actor: TAuthorizationActor,
  action: TAuthorizationAction,
  resourceType: TAuthorizationResourceType,
  scope: TResolvedAuthorizationScope
): TSpicedbCheck | null => {
  if (scope.policy) {
    return getPendingPrivateCheck(actor, action, resourceType, scope.permissionResource.id, scope.policy);
  }

  const permission = getPermission(actor, action, resourceType, scope.permissionResource.type);
  return permission ? { permission, resource: scope.permissionResource } : null;
};

/**
 * Every check that would allow the action, any one of them enough: the check above, and for a
 * `PROJECTED_NODE_ACTIONS` action the projected dashboard or page node beside it (ADR-0059).
 */
const getChecks = (
  actor: TAuthorizationActor,
  action: TAuthorizationAction,
  resourceType: TAuthorizationResourceType,
  scope: TResolvedAuthorizationScope
): ReadonlyArray<TSpicedbCheck> => {
  const check = getCheck(actor, action, resourceType, scope);
  const nodePermission = PROJECTED_NODE_ACTIONS[action as keyof typeof PROJECTED_NODE_ACTIONS];
  if (!nodePermission || !scope.projectedNode || scope.policy) return check ? [check] : [];
  return [...(check ? [check] : []), { permission: nodePermission, resource: scope.projectedNode }];
};

export const checkSpicedbPermissionAtScope = async <TAction extends TAuthorizationAction>(
  actor: TAuthorizationActor,
  action: TAction,
  resource: TAuthorizationResourceForAction<NoInfer<TAction>>,
  scope: TResolvedAuthorizationScope
): Promise<boolean> => {
  if (!scope.actorValid) return false;

  assertActionMatchesResource(action, resource.type);
  await assertAuthzedProjectionFreshness();

  const checks = getChecks(actor, action, resource.type, scope);
  const check = checks[0];
  if (!check) return false;

  const mcpGrant = getMcpGrantForActor(actor);
  try {
    if (checks.length > 1) return await checkAnyOf(actor, checks, mcpGrant);
    return mcpGrant
      ? await checkWithinMcpGrant(actor, check, mcpGrant)
      : (
          await getAuthzedClient().checkPermission({
            permission: check.permission,
            resource: toObjectReference(check.resource),
            subject: { objectId: actor.id, objectType: getSpicedbObjectType(actor.type) },
          })
        ).allowed;
  } catch (error) {
    // The previous release's schema lacks `mcp_reach`: the grant reaches nothing until it is applied,
    // exactly as the list lookups treat it.
    const reachMissing = mcpGrant !== null && isMcpReachMissingFromSchema(error);
    if (!reachMissing && !isPermissionMissingFromSchema(error, check.permission)) throw error;
    if (reachMissing) recordMcpReachDenied();
    logger.warn(
      {
        component: "authzed",
        permission: reachMissing ? MCP_REACH_PERMISSION : check.permission,
        resourceType: check.resource.type,
      },
      "AuthZed schema lacks this permission; apply the release's schema. Denying the check"
    );
    return false;
  }
};

const toObjectReference = (resource: TSpicedbCheck["resource"]) => ({
  objectId: resource.id,
  objectType: getSpicedbObjectType(resource.type),
});

/**
 * Several checks any one of which allows (`getChecks`), in one `CheckBulkPermissions` round trip. Under
 * an MCP grant that limits organization & workspace access, the grant's `mcp_reach` is asked of the first
 * check's node — the workspace — in the same request: a dashboard or page reaches exactly what its
 * workspace does (`dashboard#mcp_reach = workspace->mcp_reach`), and the workspace needs no projection.
 */
const checkAnyOf = async (
  actor: TAuthorizationActor,
  checks: ReadonlyArray<TSpicedbCheck>,
  mcpGrant: TAuthorizationMcpGrant | null
): Promise<boolean> => {
  const subject = { objectId: actor.id, objectType: getSpicedbObjectType(actor.type) };
  const decisions = await getAuthzedClient().checkPermissionBatch([
    ...checks.map((check) => ({
      permission: check.permission,
      resource: toObjectReference(check.resource),
      subject,
    })),
    ...(mcpGrant
      ? [
          {
            permission: MCP_REACH_PERMISSION,
            resource: toObjectReference(checks[0].resource),
            subject: toMcpGrantSubject(mcpGrant.id),
          },
        ]
      : []),
  ]);
  const allowed = decisions.slice(0, checks.length).some((decision) => decision === true);
  if (!mcpGrant) return allowed;

  const grantReaches = decisions[checks.length] === true;
  if (grantReaches) recordMcpReachConfirmed();
  else recordMcpReachDenied();
  return allowed && grantReaches;
};

/**
 * An MCP call whose grant limits organization & workspace access (ENG-7153, ADR-0042): the user's own
 * check and the grant's `mcp_reach` on the same node, in one `CheckBulkPermissions` round trip. Both must
 * allow, so the client reaches the intersection of what the user may do and what the grant selects.
 */
const checkWithinMcpGrant = async (
  actor: TAuthorizationActor,
  check: TSpicedbCheck,
  mcpGrant: TAuthorizationMcpGrant
): Promise<boolean> => {
  const resource = toObjectReference(check.resource);
  const [userAllowed, grantReaches] = await getAuthzedClient().checkPermissionBatch([
    {
      permission: check.permission,
      resource,
      subject: { objectId: actor.id, objectType: getSpicedbObjectType(actor.type) },
    },
    {
      permission: MCP_REACH_PERMISSION,
      resource,
      subject: toMcpGrantSubject(mcpGrant.id),
    },
  ]);
  if (grantReaches === true) recordMcpReachConfirmed();
  else recordMcpReachDenied();
  return userAllowed === true && grantReaches === true;
};

export const spicedbEvaluator: AuthorizationEvaluator = {
  async can<TAction extends TAuthorizationAction>(
    actor: TAuthorizationActor,
    action: TAction,
    resource: TAuthorizationResourceForAction<NoInfer<TAction>>
  ): Promise<boolean> {
    const scope = await resolveAuthorizationScope(actor, resource);
    if (scope) return checkSpicedbPermissionAtScope(actor, action, resource, scope);
    // Nothing to check against (an id that doesn't exist): under a grant it must read like an id outside
    // the grant, or the difference would tell a client what exists beyond it.
    if (getMcpGrantForActor(actor)) recordMcpReachDenied();
    return false;
  },
};

/** Same stored-policy and graph decisions as `can`, with bounded multi-subject requests. */
export const filterSpicedbAuthorizedUserIds = async <TAction extends TAuthorizationAction>(
  userIds: ReadonlyArray<string>,
  action: TAction,
  resource: TAuthorizationResourceForAction<NoInfer<TAction>>
): Promise<ReadonlySet<string>> => {
  const ids = [...new Set(userIds)];
  const allowed = new Set<string>();
  assertActionMatchesResource(action, resource.type);
  for (let offset = 0; offset < ids.length; offset += AUTHZED_MAX_BULK_CHECK_ITEMS) {
    const page = ids.slice(offset, offset + AUTHZED_MAX_BULK_CHECK_ITEMS);
    const scopes = await resolveAuthorizationUserBatch(page, resource);
    const checks: TAuthzedPermissionCheck[] = [];
    for (const id of page) {
      const scope = scopes.get(id);
      if (!scope?.actorValid) continue;
      // Any of a user's checks allows them (`getChecks`); each is its own item in the batch.
      for (const check of getChecks({ id, type: "user" }, action, resource.type, scope)) {
        checks.push({
          permission: check.permission,
          resource: toObjectReference(check.resource),
          subject: { objectId: id, objectType: getSpicedbObjectType("user") },
        });
      }
    }
    if (checks.length === 0) continue;
    await assertAuthzedProjectionFreshness();
    // A projected-node action asks two checks per user, so a page of users can exceed one request.
    for (let start = 0; start < checks.length; start += AUTHZED_MAX_BULK_CHECK_ITEMS) {
      const batch = checks.slice(start, start + AUTHZED_MAX_BULK_CHECK_ITEMS);
      const decisions = await getAuthzedClient().checkPermissionBatch(batch); // NOSONAR
      batch.forEach((check, index) => {
        if (decisions[index]) allowed.add(check.subject.objectId);
      });
    }
  }
  return allowed;
};
