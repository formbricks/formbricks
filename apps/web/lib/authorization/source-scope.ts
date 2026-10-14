import "server-only";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import {
  getEffectiveVisibility,
  isAwaitingProjection,
  isNeverAcknowledged,
} from "@/lib/survey/visibility/policy";
import type { TAuthorizationActor, TAuthorizationResource, TAuthorizationResourceType } from "./contract";
import {
  type TSurveyAuthorizationScopeRow,
  getActiveAuthorizationUserIds,
  getApiKeyOrganizationId,
  getAuthorizationOrganizationId,
  getDashboardAuthorizationWorkspaceScope,
  getFeedbackDirectoryAssignmentAuthorizationScope,
  getFeedbackDirectoryAuthorizationScope,
  getResponseSurveyId,
  getSurveyAuthorizationScopeRow,
  getTeamOrganizationId,
  getWorkspaceOrganizationId,
  isAuthorizationUserActive,
} from "./resolvers";

type TResolvedPermissionResource = Readonly<{
  type: TAuthorizationResourceType;
  id: string;
}>;

/**
 * A survey the graph does not hold the current version of (ENG-3282), decided from PostgreSQL facts
 * instead of its graph node. `neverAcknowledged`: the node has no edges at all yet (see
 * `isNeverAcknowledged`), so even `survey.change_visibility` cannot be asked of it.
 *
 * - `pendingPrivate` — a stored change in flight, or the initial projection of a restricted survey:
 *   restricted to its owner (along their workspace ladder) and the organization's administrators,
 *   whichever way a change points.
 * - `initialShared` — the initial projection of a workspace-visible survey: the workspace ladder, like
 *   any workspace-visible survey.
 */
export type TPendingPrivateSurveyPolicy = Readonly<{
  kind: "initialShared" | "pendingPrivate";
  neverAcknowledged: boolean;
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
 * A survey decided on the survey's own graph node once visibility is enforced — unless the graph does
 * not hold its current version (a stored change, or the initial projection, in flight). Then it is
 * decided on the workspace node plus a policy the evaluator applies from PostgreSQL facts: effectively
 * workspace-visible (the initial projection of a workspace survey) takes the workspace ladder, so the
 * key or member that created it can use it at once; anything else is restricted to its owner and the
 * administrators.
 */
const toSurveyResourceScope = (
  row: TSurveyAuthorizationScopeRow | null,
  graphReady: boolean
): TResourceScope | null => {
  if (!row) return null;
  if (graphReady && !isAwaitingProjection(row)) {
    return { organizationId: row.organizationId, permissionResource: { type: "survey", id: row.id } };
  }
  return {
    organizationId: row.organizationId,
    permissionResource: { type: "workspace", id: row.workspaceId },
    policy: {
      kind: getEffectiveVisibility(row) === "workspace" ? "initialShared" : "pendingPrivate",
      neverAcknowledged: !graphReady || isNeverAcknowledged(row),
      ownerId: row.ownerId,
      surveyId: row.id,
    },
  };
};

/** Read the stored visibility even when the graph has not been activated or readiness was cleared. */
const resolveSurveyScope = async (surveyId: string): Promise<TResourceScope | null> => {
  const [row, graphReady] = await Promise.all([
    getSurveyAuthorizationScopeRow(surveyId),
    isSurveyVisibilityReady(),
  ]);
  return toSurveyResourceScope(row, graphReady);
};

/** Responses follow the same policy as their survey. */
const resolveResponseScope = async (responseId: string): Promise<TResourceScope | null> => {
  const surveyId = await getResponseSurveyId(responseId);
  return surveyId ? resolveSurveyScope(surveyId) : null;
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

/** Resolve shared resource facts once for a recipient batch, retaining active-user validation. */
export const resolveAuthorizationUserBatch = async (
  userIds: ReadonlyArray<string>,
  resource: TAuthorizationResource
): Promise<ReadonlyMap<string, TResolvedAuthorizationScope>> => {
  const [scope, activeIds] = await Promise.all([
    resolveResourceScope(resource),
    getActiveAuthorizationUserIds(userIds),
  ]);
  if (!scope) return new Map();
  return new Map(userIds.map((id) => [id, { ...scope, actorValid: activeIds.has(id) }]));
};
