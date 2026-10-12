import "server-only";
import { getAuthzedClient } from "@/lib/authzed/client";
import { assertAuthzedProjectionFreshness } from "@/lib/authzed/outbox-freshness";
import { USER_MANAGEMENT_MINIMUM_ROLE } from "@/lib/constants";
import {
  AUTHORIZATION_PERMISSION_MAP,
  type TAuthorizationAction,
  type TAuthorizationActor,
  type TAuthorizationResourceForAction,
  type TAuthorizationResourceType,
} from "./contract";
import type { AuthorizationEvaluator } from "./evaluator";
import { getSpicedbObjectType } from "./object-type";
import {
  type TPendingPrivateSurveyPolicy,
  type TResolvedAuthorizationScope,
  resolveAuthorizationScope,
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
 * The workspace permission a survey, response or dashboard action is decided by whenever the decision is
 * made on the workspace node: always for dashboards, and for surveys and responses while survey
 * visibility is not enforced (readiness marker off) or a change is pending. `survey.change_visibility`
 * is deliberately absent — it has no workspace equivalent.
 */
const WORKSPACE_PERMISSION_FOR_DERIVED_ACTION = {
  "dashboard.read": "read",
  "dashboard.write": "write",
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
} as const satisfies Partial<Record<TAuthorizationAction, "manage" | "read" | "write">>;

/** A response action decided on its survey's node (ENG-3282): the survey permission it inherits. */
const SURVEY_PERMISSION_FOR_RESPONSE_ACTION = {
  "response.export": "response_export",
  "response.manage": "manage",
  "response.read": "response_read",
  "response.write": "write",
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

  return parseAction(action).permission;
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
  if (!ladder) return null;

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

export const checkSpicedbPermissionAtScope = async <TAction extends TAuthorizationAction>(
  actor: TAuthorizationActor,
  action: TAction,
  resource: TAuthorizationResourceForAction<NoInfer<TAction>>,
  scope: TResolvedAuthorizationScope
): Promise<boolean> => {
  if (!scope.actorValid) return false;

  assertActionMatchesResource(action, resource.type);
  await assertAuthzedProjectionFreshness();

  const check = getCheck(actor, action, resource.type, scope);
  if (!check) return false;

  const decision = await getAuthzedClient().checkPermission({
    permission: check.permission,
    resource: {
      objectId: check.resource.id,
      objectType: getSpicedbObjectType(check.resource.type),
    },
    subject: {
      objectId: actor.id,
      objectType: getSpicedbObjectType(actor.type),
    },
  });

  return decision.allowed;
};

export const spicedbEvaluator: AuthorizationEvaluator = {
  async can<TAction extends TAuthorizationAction>(
    actor: TAuthorizationActor,
    action: TAction,
    resource: TAuthorizationResourceForAction<NoInfer<TAction>>
  ): Promise<boolean> {
    const scope = await resolveAuthorizationScope(actor, resource);
    return scope ? checkSpicedbPermissionAtScope(actor, action, resource, scope) : false;
  },
};
