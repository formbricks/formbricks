import "server-only";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import { getEffectiveVisibility, isPending } from "@/lib/survey/visibility/policy";
import type { TAuthorizationActor, TAuthorizationResource, TAuthorizationResourceType } from "./contract";
import {
  type TSurveyAuthorizationScopeRow,
  getApiKeyOrganizationId,
  getAuthorizationOrganizationId,
  getDashboardAuthorizationWorkspaceScope,
  getFeedbackDirectoryAssignmentAuthorizationScope,
  getFeedbackDirectoryAuthorizationScope,
  getResponseAuthorizationWorkspaceScope,
  getResponseSurveyId,
  getSurveyAuthorizationScopeRow,
  getSurveyAuthorizationWorkspaceScope,
  getTeamOrganizationId,
  getWorkspaceOrganizationId,
  isAuthorizationUserActive,
} from "./resolvers";

type TResolvedPermissionResource = Readonly<{
  type: TAuthorizationResourceType;
  id: string;
}>;

/**
 * A survey whose visibility change the graph has not acknowledged yet (ENG-3282). The graph still
 * holds the previous version, so the decision is made from PostgreSQL facts instead: restricted to its
 * owner (along their workspace ladder) and the organization's administrators, whichever way the
 * change points.
 */
export type TPendingPrivateSurveyPolicy = Readonly<{
  kind: "pendingPrivate";
  ownerId: string | null;
  surveyId: string;
}>;

export type TResolvedAuthorizationScope = Readonly<{
  actorValid: boolean;
  organizationId: string;
  permissionResource: TResolvedPermissionResource;
  policy?: TPendingPrivateSurveyPolicy;
}>;

type TResourceScope = Readonly<{
  organizationId: string;
  permissionResource: TResolvedPermissionResource;
  policy?: TPendingPrivateSurveyPolicy;
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

/**
 * A survey decided on the survey's own graph node once visibility is enforced. A pending row is never
 * decided there — the graph does not hold its version, and a never-projected survey's node has no edges
 * at all, so even its owner would be denied:
 * - effectively workspace-visible (inserted workspace-visible and never changed, see
 *   `isNeverProjected`): the workspace ladder, exactly as for any workspace-visible survey, so the key or
 *   member that created it can use it at once;
 * - otherwise: the workspace node plus a policy the evaluator applies from PostgreSQL facts (owner along
 *   their ladder, else administrators; never an API key).
 */
const toSurveyResourceScope = (row: TSurveyAuthorizationScopeRow | null): TResourceScope | null => {
  if (!row) return null;
  if (isPending(row) && getEffectiveVisibility(row) === "workspace") {
    return {
      organizationId: row.organizationId,
      permissionResource: { type: "workspace", id: row.workspaceId },
    };
  }
  if (isPending(row)) {
    return {
      organizationId: row.organizationId,
      permissionResource: { type: "workspace", id: row.workspaceId },
      policy: { kind: "pendingPrivate", ownerId: row.ownerId, surveyId: row.id },
    };
  }
  return { organizationId: row.organizationId, permissionResource: { type: "survey", id: row.id } };
};

/** Readiness marker off: exactly the pre-ENG-3282 behaviour, workspace permissions throughout. */
const resolveSurveyScope = async (surveyId: string): Promise<TResourceScope | null> =>
  (await isSurveyVisibilityReady())
    ? toSurveyResourceScope(await getSurveyAuthorizationScopeRow(surveyId))
    : toWorkspaceResourceScope(await getSurveyAuthorizationWorkspaceScope(surveyId));

/** Responses follow their survey (contract §7). */
const resolveResponseScope = async (responseId: string): Promise<TResourceScope | null> => {
  if (!(await isSurveyVisibilityReady())) {
    return toWorkspaceResourceScope(await getResponseAuthorizationWorkspaceScope(responseId));
  }
  const surveyId = await getResponseSurveyId(responseId);
  return surveyId ? toSurveyResourceScope(await getSurveyAuthorizationScopeRow(surveyId)) : null;
};

const resolveResourceScope = async (resource: TAuthorizationResource): Promise<TResourceScope | null> => {
  switch (resource.type) {
    case "organization": {
      const organizationId = await getAuthorizationOrganizationId(resource.id);
      return organizationId
        ? { organizationId, permissionResource: { type: resource.type, id: resource.id } }
        : null;
    }
    case "workspace":
      return resolveWorkspaceScope(resource.id);
    case "team": {
      const organizationId = await getTeamOrganizationId(resource.id);
      return organizationId
        ? { organizationId, permissionResource: { type: resource.type, id: resource.id } }
        : null;
    }
    case "apiKey": {
      const organizationId = await getApiKeyOrganizationId(resource.id);
      return organizationId
        ? { organizationId, permissionResource: { type: resource.type, id: resource.id } }
        : null;
    }
    case "survey":
      return resolveSurveyScope(resource.id);
    case "dashboard": {
      return toWorkspaceResourceScope(await getDashboardAuthorizationWorkspaceScope(resource.id));
    }
    case "response":
      return resolveResponseScope(resource.id);
    case "feedbackDirectory": {
      const scope = await getFeedbackDirectoryAuthorizationScope(resource.id);
      // Archive state is an authoritative PostgreSQL policy input, not a projected relationship.
      // Deny it before consulting SpiceDB so organization administrators cannot retain access through
      // feedback_directory#organization while the directory is archived.
      return scope && !scope.isArchived
        ? {
            organizationId: scope.organizationId,
            permissionResource: { type: resource.type, id: resource.id },
          }
        : null;
    }
    case "feedbackDirectoryAssignment": {
      const scope = await getFeedbackDirectoryAssignmentAuthorizationScope(
        resource.feedbackDirectoryId,
        resource.workspaceId
      );
      return scope
        ? {
            organizationId: scope.organizationId,
            permissionResource: {
              id: scope.assignmentId,
              type: "feedbackDirectoryAssignment",
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
