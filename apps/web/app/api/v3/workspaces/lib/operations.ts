import "server-only";
import { logger } from "@formbricks/logger";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { DatabaseError } from "@formbricks/types/errors";
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

// Defensive cap: a user's accessible workspaces are naturally small, but never stream an unbounded list.
const MAX_WORKSPACES = 500;

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
 * List the workspaces the authenticated principal can access.
 *
 * - Session user: every workspace across the orgs they're a member of (org owners/managers see all of
 *   an org's workspaces; `member`-role users see only team-scoped ones — enforced by `getUserWorkspaces`).
 * - API key: only the workspaces in its `workspacePermissions`.
 *
 * There is no `workspaceId` input, so there is no IDOR surface — the result is always derived from the
 * caller's own live membership / key grants, never from client-supplied ids.
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
      const userId = authentication.user.id;
      // Only the caller's own orgs; `getUserWorkspaces` then scopes to team-accessible workspaces for
      // `member`-role users. Both together guarantee we never return a workspace the user can't access.
      const organizations = await getOrganizationsByUserId(userId);
      const workspacesPerOrg = await Promise.all(
        organizations.map((organization) => getUserWorkspaces(userId, organization.id))
      );

      // Dedupe by id (a user can't be in the same org twice, but stay defensive).
      const byId = new Map<string, TV3WorkspaceListItem>();
      for (const workspace of workspacesPerOrg.flat()) {
        byId.set(workspace.id, serializeV3WorkspaceListItem(workspace));
      }
      items = Array.from(byId.values());
    } else {
      const keyAuth = authentication as TAuthenticationApiKey;
      if (!keyAuth.apiKeyId || !Array.isArray(keyAuth.workspacePermissions)) {
        return problemUnauthorized(requestId, "Not authenticated", instance);
      }

      // The key's authorized set is exactly its workspacePermissions — resolve those, nothing else.
      const workspaceIds = Array.from(
        new Set(keyAuth.workspacePermissions.map((permission) => permission.workspaceId))
      );
      const workspaces = await Promise.all(workspaceIds.map((id) => getWorkspace(id)));
      items = workspaces
        .filter((workspace): workspace is NonNullable<typeof workspace> => workspace !== null)
        .map(serializeV3WorkspaceListItem);
    }

    const capped = items.slice(0, MAX_WORKSPACES);
    return successListResponse(
      capped,
      { limit: MAX_WORKSPACES, nextCursor: null, totalCount: capped.length },
      { requestId, cache: "private, no-store" }
    );
  } catch (error) {
    if (error instanceof DatabaseError) {
      log.error({ error, statusCode: 500 }, "Database error");
      return problemInternalError(requestId, "An unexpected error occurred.", instance);
    }
    throw error;
  }
}
