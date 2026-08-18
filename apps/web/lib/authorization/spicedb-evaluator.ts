import "server-only";
import { getAuthzedClient } from "@/lib/authzed/client";
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
import { type TResolvedAuthorizationScope, resolveAuthorizationScope } from "./source-scope";

const parseAction = (
  action: TAuthorizationAction
): Readonly<{ permission: string; resourceType: TAuthorizationResourceType }> => {
  const separator = action.indexOf(".");
  return {
    permission: action.slice(separator + 1),
    resourceType: action.slice(0, separator) as TAuthorizationResourceType,
  };
};

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

const getPermission = (
  actor: TAuthorizationActor,
  action: TAuthorizationAction,
  resourceType: TAuthorizationResourceType
): string | null => {
  const parsed = parseAction(action);
  if (
    parsed.resourceType !== resourceType ||
    !(AUTHORIZATION_PERMISSION_MAP[resourceType] as readonly string[]).includes(parsed.permission)
  ) {
    throw new Error(`Invalid authorization action/resource combination`);
  }

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

  if (action in WORKSPACE_PERMISSION_FOR_DERIVED_ACTION) {
    return WORKSPACE_PERMISSION_FOR_DERIVED_ACTION[
      action as keyof typeof WORKSPACE_PERMISSION_FOR_DERIVED_ACTION
    ];
  }

  return parsed.permission;
};

export const checkSpicedbPermissionAtScope = async <TAction extends TAuthorizationAction>(
  actor: TAuthorizationActor,
  action: TAction,
  resource: TAuthorizationResourceForAction<NoInfer<TAction>>,
  scope: TResolvedAuthorizationScope
): Promise<boolean> => {
  if (!scope.actorValid) return false;

  const permission = getPermission(actor, action, resource.type);
  if (!permission) return false;

  const decision = await getAuthzedClient().checkPermission({
    permission,
    resource: {
      objectId: scope.permissionResource.id,
      objectType: getSpicedbObjectType(scope.permissionResource.type),
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
