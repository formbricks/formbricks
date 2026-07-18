import "server-only";
import { logger } from "@formbricks/logger";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { problemInternalError, problemUnauthorized, successListResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getOrganizationsByUserId } from "@/lib/organization/service";
import { getUserWorkspaces, getWorkspace } from "@/lib/workspace/service";

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

const serializeV3WorkspaceListItem = (workspace: {
  id: string;
  name: string;
  organizationId: string;
}): TV3WorkspaceListItem => ({
  id: workspace.id,
  name: workspace.name,
  organizationId: workspace.organizationId,
});

/**
 * Session user's accessible workspaces: every workspace across the orgs they're a member of. Scoping is
 * enforced by the reused services — `getOrganizationsByUserId` limits to the user's own orgs, and
 * `getUserWorkspaces` returns all of an org's workspaces for owners/managers but only team-scoped ones
 * for `member`-role users.
 */
async function fetchSessionWorkspaces(userId: string): Promise<TV3WorkspaceListItem[]> {
  const organizations = await getOrganizationsByUserId(userId);
  const workspacesPerOrg = await Promise.all(
    organizations.map((organization) => getUserWorkspaces(userId, organization.id))
  );
  return workspacesPerOrg.flat().map(serializeV3WorkspaceListItem);
}

/** API key's accessible workspaces: exactly the ones named in its `workspacePermissions`, nothing else. */
async function fetchApiKeyWorkspaces(keyAuth: TAuthenticationApiKey): Promise<TV3WorkspaceListItem[]> {
  const workspaceIds = Array.from(new Set(keyAuth.workspacePermissions.map((p) => p.workspaceId)));
  const workspaces = await Promise.all(workspaceIds.map((id) => getWorkspace(id)));
  return workspaces
    .filter((workspace): workspace is NonNullable<typeof workspace> => workspace !== null)
    .map(serializeV3WorkspaceListItem);
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
    let items: TV3WorkspaceListItem[];

    if ("user" in authentication && authentication.user?.id) {
      items = await fetchSessionWorkspaces(authentication.user.id);
    } else if (
      "apiKeyId" in authentication &&
      authentication.apiKeyId &&
      Array.isArray(authentication.workspacePermissions)
    ) {
      items = await fetchApiKeyWorkspaces(authentication);
    } else {
      return problemUnauthorized(requestId, "Not authenticated", instance);
    }

    // Dedupe by id (defensive) + a stable, deterministic order — the underlying queries have no ORDER BY,
    // so without this the output would vary between calls.
    const deduped = Array.from(new Map(items.map((item) => [item.id, item])).values()).sort(
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
    // Log every failure with request context (not just DatabaseError) so nothing significant is lost,
    // and always return a clean 500 instead of throwing a raw error past this boundary.
    log.error({ error, statusCode: 500 }, "Failed to list workspaces");
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }
}
