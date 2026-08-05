import "server-only";
import type { TAuthorizationActor, TAuthorizationResource } from "./contract";
import {
  getApiKeyOrganizationId,
  getAuthorizationOrganizationId,
  getDashboardWorkspaceId,
  getResponseSurveyId,
  getSurveyWorkspaceId,
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
      const workspaceId = await getSurveyWorkspaceId(resource.id);
      return workspaceId ? resolveWorkspaceScope(workspaceId) : null;
    }
    case "dashboard": {
      const workspaceId = await getDashboardWorkspaceId(resource.id);
      return workspaceId ? resolveWorkspaceScope(workspaceId) : null;
    }
    case "response": {
      const surveyId = await getResponseSurveyId(resource.id);
      if (!surveyId) return null;
      const workspaceId = await getSurveyWorkspaceId(surveyId);
      return workspaceId ? resolveWorkspaceScope(workspaceId) : null;
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
  const resourceScope = await resolveResourceScope(resource);
  if (!resourceScope) return null;

  if (actor.type === "user") {
    return {
      actorValid: await isAuthorizationUserActive(actor.id),
      ...resourceScope,
    };
  }

  const actorOrganizationId = await getApiKeyOrganizationId(actor.id);
  return {
    actorValid: actorOrganizationId !== null && actorOrganizationId === resourceScope.organizationId,
    ...resourceScope,
  };
};
