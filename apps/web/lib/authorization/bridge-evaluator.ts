import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { USER_MANAGEMENT_MINIMUM_ROLE } from "@/lib/constants";
import { getUserManagementAccess } from "@/lib/membership/utils";
import {
  type TBridgeWorkspacePermission,
  bridgeKeyHasOrganizationAccess,
  bridgeKeyWorkspaceIds,
  findBridgeUserWorkspaceIds,
} from "./bridge-access";
import {
  AUTHORIZATION_PERMISSION_MAP,
  type TAuthorizationAction,
  type TAuthorizationActor,
  type TAuthorizationResourceForAction,
} from "./contract";
import type { AuthorizationEvaluator } from "./evaluator";
import { getApiKeyAuthById } from "./resolvers";
import { resolveAuthorizationScope } from "./source-scope";

const getMembershipRole = reactCache(async (userId: string, organizationId: string) => {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true },
  });
  return membership?.role;
});

const WORKSPACE_PERMISSION = {
  "workspace.read": "read",
  "workspace.write": "write",
  "workspace.manage": "manage",
  "workspace.share": "manage",
  "survey.read": "read",
  "survey.write": "write",
  "survey.manage": "manage",
  "survey.delete": "write",
  "survey.publish": "write",
  "survey.response_read": "read",
  "survey.response_export": "read",
  "dashboard.read": "read",
  "dashboard.write": "write",
  "response.read": "read",
  "response.write": "write",
  "response.manage": "manage",
  "response.export": "read",
} as const satisfies Partial<Record<TAuthorizationAction, TBridgeWorkspacePermission>>;

const canOrganization = async (
  actor: TAuthorizationActor,
  permission: string,
  organizationId: string
): Promise<boolean> => {
  if (actor.type === "apiKey") {
    const auth = await getApiKeyAuthById(actor.id);
    if (!auth || auth.organizationId !== organizationId) return false;
    if (permission === "read" || permission === "read_access")
      return bridgeKeyHasOrganizationAccess(auth, "read");
    return permission === "manage_access" && bridgeKeyHasOrganizationAccess(auth, "write");
  }

  const role = await getMembershipRole(actor.id, organizationId);
  const administers = role === "owner" || role === "manager";
  switch (permission) {
    case "read":
      return role !== undefined;
    case "write":
      return role === "owner";
    case "manage":
    case "manage_api_keys":
      return administers;
    case "manage_billing":
      return administers || role === "billing";
    case "read_access":
      return administers || role === "member";
    case "manage_access":
      return role !== undefined && getUserManagementAccess(role, USER_MANAGEMENT_MINIMUM_ROLE);
    default:
      return false;
  }
};

const accessibleWorkspaceIds = async (
  actor: TAuthorizationActor,
  permission: TBridgeWorkspacePermission,
  organizationId: string,
  workspaceId?: string
): Promise<ReadonlyArray<string>> => {
  if (actor.type === "user")
    return findBridgeUserWorkspaceIds(actor.id, permission, organizationId, workspaceId);
  const auth = await getApiKeyAuthById(actor.id);
  return auth?.organizationId === organizationId ? bridgeKeyWorkspaceIds(auth, permission) : [];
};

/**
 * Disposable rc.5 Cloud bridge: PostgreSQL is the only decision engine. No fallback, rollout
 * selector, SDK operation or projection-freshness dependency belongs on this path. Keep the rc.5
 * scope resolver so inactive/deleted actors, missing/archived resources and foreign API keys deny.
 * Database failures are operational errors, never denials; the coordinator sanitizes them.
 */
export const bridgeEvaluator: AuthorizationEvaluator = {
  async can<TAction extends TAuthorizationAction>(
    actor: TAuthorizationActor,
    action: TAction,
    resource: TAuthorizationResourceForAction<NoInfer<TAction>>
  ): Promise<boolean> {
    const [resourceType, permission] = action.split(".");
    const permissions: readonly string[] | undefined = AUTHORIZATION_PERMISSION_MAP[resource.type];
    if (
      resourceType !== resource.type ||
      !permissions?.includes(permission) ||
      action !== `${resourceType}.${permission}`
    ) {
      throw new Error("Invalid authorization action/resource combination");
    }
    if (actor.type !== "user" && actor.type !== "apiKey") throw new Error("Unsupported authorization actor");

    const scope = await resolveAuthorizationScope(actor, resource);
    if (!scope?.actorValid) return false;
    const { organizationId } = scope;

    if (action in WORKSPACE_PERMISSION) {
      const required = WORKSPACE_PERMISSION[action as keyof typeof WORKSPACE_PERMISSION];
      const workspaceId = scope.permissionResource.id;
      return (await accessibleWorkspaceIds(actor, required, organizationId, workspaceId)).includes(
        workspaceId
      );
    }

    switch (resource.type) {
      case "organization":
        return canOrganization(actor, permission, organizationId);
      case "apiKey":
        return actor.type === "user" && canOrganization(actor, "manage_api_keys", organizationId);
      case "team": {
        if (actor.type === "apiKey") {
          return canOrganization(
            actor,
            permission === "read" ? "read_access" : "manage_access",
            organizationId
          );
        }
        // Team administration uses the current owner/manager rule, not the configurable invitation floor.
        if (permission === "read") return canOrganization(actor, "read_access", organizationId);
        if (await canOrganization(actor, "manage", organizationId)) return true;
        if (permission === "delete") return false;
        const membership = await prisma.teamUser.findUnique({
          where: { teamId_userId: { teamId: resource.id, userId: actor.id } },
          select: { role: true },
        });
        return membership?.role === "admin";
      }
      case "feedbackDirectory":
      case "feedbackDirectoryAssignment": {
        if (await canOrganization(actor, "manage", organizationId)) return true;
        const required = permission as TBridgeWorkspacePermission;
        if (resource.type === "feedbackDirectoryAssignment") {
          return (
            await accessibleWorkspaceIds(actor, required, organizationId, resource.workspaceId)
          ).includes(resource.workspaceId);
        }
        const [assignments, accessibleIds] = await Promise.all([
          prisma.feedbackDirectoryWorkspace.findMany({
            where: { feedbackDirectoryId: resource.id, workspace: { organizationId } },
            select: { workspaceId: true },
          }),
          accessibleWorkspaceIds(actor, required, organizationId),
        ]);
        const accessible = new Set(accessibleIds);
        return assignments.some(({ workspaceId }) => accessible.has(workspaceId));
      }
      default:
        throw new Error("Unsupported authorization action");
    }
  },
};
