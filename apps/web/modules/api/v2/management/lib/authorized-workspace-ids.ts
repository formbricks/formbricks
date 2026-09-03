import "server-only";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";

/**
 * Intersect the API key's PostgreSQL scope with the sole authoritative SpiceDB workspace list.
 *
 * PostgreSQL remains the source of grant metadata and tenant scoping, while SpiceDB is the decision
 * engine. Neither set can widen the other: stale database grants are denied by SpiceDB, and an
 * unexpected SpiceDB relationship cannot add a workspace that is absent from the authenticated key's
 * same-organization grant set. Lookup or freshness failures propagate so collection reads fail closed.
 */
export const getAuthorizedApiKeyWorkspaceIds = async (
  authentication: TAuthenticationApiKey
): Promise<string[]> => {
  const authorizedWorkspaceIds = new Set(
    await lookupAuthorizedWorkspaceIds({ type: "apiKey", id: authentication.apiKeyId }, "read")
  );

  return [
    ...new Set(
      authentication.workspacePermissions
        .map(({ workspaceId }) => workspaceId)
        .filter((workspaceId) => authorizedWorkspaceIds.has(workspaceId))
    ),
  ];
};
