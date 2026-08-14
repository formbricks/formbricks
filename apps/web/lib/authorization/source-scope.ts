import "server-only";
import type { TAuthorizationActor, TAuthorizationResource } from "./contract";
import {
  getApiKeyOrganizationId,
  getAuthorizationOrganizationId,
  getDashboardAuthorizationWorkspaceScope,
  getFeedbackDirectoryAssignmentAuthorizationScope,
  getFeedbackDirectoryAuthorizationScope,
  getResponseAuthorizationWorkspaceScope,
  getSurveyAuthorizationWorkspaceScope,
  getTeamOrganizationId,
  getWorkspaceOrganizationId,
  isAuthorizationUserActive,
} from "./resolvers";

export type TResolvedAuthorizationScope = Readonly<{
  actorValid: boolean;
  organizationId: string;
  permissionResource: TAuthorizationResource;
}>;

type TResourceScope = Readonly<{
  organizationId: string;
  permissionResource: TAuthorizationResource;
}>;

const resolveWorkspaceScope = async (workspaceId: string): Promise<TResourceScope | null> => {
  const organizationId = await getWorkspaceOrganizationId(workspaceId);
  return organizationId
    ? { organizationId, permissionResource: { type: "workspace", id: workspaceId } }
    : null;
};

const toWorkspaceResourceScope = (
  scope: Readonly<{ organizationId: string; workspaceId: string }> | null
): TResourceScope | null =>
  scope
    ? {
        organizationId: scope.organizationId,
        permissionResource: { type: "workspace", id: scope.workspaceId },
      }
    : null;

const resolveResourceScope = async (resource: TAuthorizationResource): Promise<TResourceScope | null> => {
  switch (resource.type) {
    case "organization": {
      const organizationId = await getAuthorizationOrganizationId(resource.id);
      return organizationId ? { organizationId, permissionResource: resource } : null;
    }
    case "workspace":
      return resolveWorkspaceScope(resource.id);
    case "team": {
      const organizationId = await getTeamOrganizationId(resource.id);
      return organizationId ? { organizationId, permissionResource: resource } : null;
    }
    case "apiKey": {
      const organizationId = await getApiKeyOrganizationId(resource.id);
      return organizationId ? { organizationId, permissionResource: resource } : null;
    }
    case "survey": {
      return toWorkspaceResourceScope(await getSurveyAuthorizationWorkspaceScope(resource.id));
    }
    case "dashboard": {
      return toWorkspaceResourceScope(await getDashboardAuthorizationWorkspaceScope(resource.id));
    }
    case "response": {
      return toWorkspaceResourceScope(await getResponseAuthorizationWorkspaceScope(resource.id));
    }
    case "feedbackDirectory": {
      const scope = await getFeedbackDirectoryAuthorizationScope(resource.id);
      return scope && !scope.isArchived
        ? { organizationId: scope.organizationId, permissionResource: resource }
        : null;
    }
    case "feedbackDirectoryAssignment": {
      const scope = await getFeedbackDirectoryAssignmentAuthorizationScope(resource.id, resource.workspaceId);
      return scope
        ? {
            organizationId: scope.organizationId,
            permissionResource: {
              id: scope.assignmentId,
              type: "feedbackDirectoryAssignment",
              workspaceId: scope.workspaceId,
            },
          }
        : null;
    }
  }
};

/**
 * Resolve the authoritative PostgreSQL tenant boundary before consulting the
 * SpiceDB projection. Missing actors/resources are genuine denials; database
 * failures propagate so the caller can distinguish them from a denied check.
 */
export const resolveAuthorizationScope = async (
  actor: TAuthorizationActor,
  resource: TAuthorizationResource
): Promise<TResolvedAuthorizationScope | null> => {
  if (actor.type === "user") {
    const [resourceScope, actorValid] = await Promise.all([
      resolveResourceScope(resource),
      isAuthorizationUserActive(actor.id),
    ]);
    if (!resourceScope) return null;

    return {
      actorValid,
      ...resourceScope,
    };
  }

  const [resourceScope, actorOrganizationId] = await Promise.all([
    resolveResourceScope(resource),
    getApiKeyOrganizationId(actor.id),
  ]);
  if (!resourceScope) return null;

  return {
    actorValid: actorOrganizationId !== null && actorOrganizationId === resourceScope.organizationId,
    ...resourceScope,
  };
};
