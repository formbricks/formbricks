import "server-only";
import { logger } from "@formbricks/logger";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { problemInternalError, problemUnauthorized, successListResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import type { TAuthorizationActor } from "@/lib/authorization";
import { lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";
import { AuthzedError } from "@/lib/authzed/errors";
import { getOrganizationScopedWorkspacesByIdsForUser, getWorkspacesByIds } from "@/lib/workspace/service";

type TListV3WorkspacesParams = {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

/** Minimal DTO — never return the raw Workspace entity (no config/env/styling internals). */
type TV3WorkspaceListItem = {
  id: string;
  name: string;
  organizationId: string;
};

type TResolvedWorkspaceList = Readonly<{
  items: ReadonlyArray<TV3WorkspaceListItem>;
}>;

const serializeV3WorkspaceListItem = (workspace: {
  id: string;
  name: string;
  organizationId: string;
}): TV3WorkspaceListItem => ({
  id: workspace.id,
  name: workspace.name,
  organizationId: workspace.organizationId,
});

/** Session user's accessible workspaces from one authoritative `LookupResources(workspace, read)`. */
async function fetchSessionWorkspaces(
  userId: string,
  actor: Extract<TAuthorizationActor, { type: "user" }>
): Promise<TResolvedWorkspaceList> {
  const workspaceIds = await lookupAuthorizedWorkspaceIds(actor);
  const workspaces = await getOrganizationScopedWorkspacesByIdsForUser(userId, [...workspaceIds]);
  return {
    items: workspaces.map(serializeV3WorkspaceListItem),
  };
}

/** API key's accessible workspaces: the authoritative SpiceDB `workspace.read` result in its organization. */
async function fetchApiKeyWorkspaces(
  keyAuth: TAuthenticationApiKey,
  actor: Extract<TAuthorizationActor, { type: "apiKey" }>
): Promise<TResolvedWorkspaceList> {
  const workspaceIds = await lookupAuthorizedWorkspaceIds(actor);
  const workspaces = await getWorkspacesByIds(keyAuth.organizationId, [...workspaceIds]);
  const sameOrganizationWorkspaces = workspaces.filter(
    (workspace) => workspace.organizationId === keyAuth.organizationId
  );
  return {
    items: sameOrganizationWorkspaces.map(serializeV3WorkspaceListItem),
  };
}

/**
 * List the workspaces the authenticated principal can access (session user or API key). There is no
 * `workspaceId` input, so there is no IDOR surface — the result is always derived from the caller's own
 * live membership / key grants, never from client-supplied ids.
 *
 * Thin orchestrator: resolve the principal's workspaces → dedupe → order → cap → respond. The per-
 * principal access resolution lives in the `fetch*Workspaces` helpers.
 */
export async function listV3Workspaces({
  authentication,
  requestId,
  instance,
}: TListV3WorkspacesParams): Promise<Response> {
  if (!authentication) {
    return problemUnauthorized(requestId, "Not authenticated", instance);
  }

  const log = logger.withContext({ requestId });

  try {
    const actor = getV3AuthorizationActor(authentication);
    if (!actor) {
      return problemUnauthorized(requestId, "Not authenticated", instance);
    }

    let resolved: TResolvedWorkspaceList;

    if ("user" in authentication && authentication.user?.id) {
      if (actor.type !== "user") return problemUnauthorized(requestId, "Not authenticated", instance);
      resolved = await fetchSessionWorkspaces(authentication.user.id, actor);
    } else if (
      "apiKeyId" in authentication &&
      authentication.apiKeyId &&
      Array.isArray(authentication.workspacePermissions)
    ) {
      if (actor.type !== "apiKey") return problemUnauthorized(requestId, "Not authenticated", instance);
      resolved = await fetchApiKeyWorkspaces(authentication, actor);
    } else {
      return problemUnauthorized(requestId, "Not authenticated", instance);
    }

    // Dedupe by id (defensive) + a stable, deterministic order — the underlying queries have no ORDER BY,
    // so without this the output would vary between calls.
    const deduped = Array.from(new Map(resolved.items.map((item) => [item.id, item])).values()).sort(
      (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
    );

    // No pagination: a principal's accessible workspaces are bounded by their memberships (small), so we
    // return them all. No arbitrary cap — a truncation here would silently hide workspaces (the tool
    // accepts no cursor) without bounding DB work, which was already done above.
    return successListResponse(
      deduped,
      { nextCursor: null, totalCount: deduped.length },
      { requestId, cache: "private, no-store" }
    );
  } catch (error) {
    // Keep this boundary observable without serializing raw SDK/database errors or tenant identifiers.
    log.error(
      {
        errorCode: error instanceof AuthzedError ? error.code : "internal",
        statusCode: 500,
      },
      "Failed to list workspaces"
    );
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }
}
