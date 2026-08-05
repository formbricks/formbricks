import type { ApiKeyPermission } from "@formbricks/database/prisma";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";

// Pure authorization logic for the feedback records gateway. Kept free of server-only, Prisma, and
// env imports so it can be unit-tested in isolation (the gateway module itself pulls in the full
// request/DB/env stack).

export type TFeedbackRecordsGatewayPermission = "read" | "write";

const apiKeyPermissionWeight: Record<ApiKeyPermission, number> = {
  read: 1,
  write: 2,
  manage: 3,
};

const gatewayPermissionToApiKeyPermissionWeight: Record<TFeedbackRecordsGatewayPermission, number> = {
  read: apiKeyPermissionWeight.read,
  write: apiKeyPermissionWeight.write,
};

/**
 * Whether an API key may access a feedback directory's records.
 *
 * Feedback records are workspace-scoped DATA, so access is granted solely by the key's per-workspace
 * permissions (`workspacePermissions`) — never by `organizationAccess.accessControl`. That org-level
 * flag governs organization MANAGEMENT (members, teams, roles), not workspace data: the API-key UI
 * describes it as "Members and teams only — not workspace data", and every other consumer
 * (`hasOrganizationAccess`, the org users/teams endpoints) uses it only for org-admin operations.
 * Granting record access from it would let a members-management key read/write feedback data and
 * would make the workspace-permission check below redundant, so it is deliberately not consulted.
 *
 * Access additionally requires the key to belong to the directory's organization. The
 * workspace-permission match already implies the same organization (a key's `workspacePermissions`
 * only contain workspaces in its own org — see `authenticateApiKeyFromHeaders`), so the up-front
 * organization check is defense-in-depth: it keeps this decision correct on its own, and prevents
 * cross-tenant access (ENG-1980) even if that upstream invariant ever regresses.
 */
export const hasApiKeyImplicitFeedbackDirectoryAccess = (
  authentication: TAuthenticationApiKey,
  directoryOrganizationId: string,
  workspaceIds: string[],
  requiredPermission: TFeedbackRecordsGatewayPermission
): boolean => {
  // The key must belong to the directory's organization.
  if (authentication.organizationId !== directoryOrganizationId) {
    return false;
  }

  const matchingWeights = authentication.workspacePermissions
    .filter((permission) => workspaceIds.includes(permission.workspaceId))
    .map((permission) => apiKeyPermissionWeight[permission.permission]);

  if (matchingWeights.length === 0) {
    return false;
  }

  const maxWeight = Math.max(...matchingWeights);
  return maxWeight >= gatewayPermissionToApiKeyPermissionWeight[requiredPermission];
};
