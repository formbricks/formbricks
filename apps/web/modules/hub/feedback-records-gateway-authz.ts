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
 * Both access paths — organization-level access control (`organizationAccess.accessControl`) and
 * the per-workspace permissions — require the key to belong to the directory's organization. A key
 * with access in organization A must never satisfy the check for a directory in organization B
 * (cross-tenant access, ENG-1980), so the organization match is enforced up front for both paths.
 *
 * The workspace-permission path is already org-scoped upstream (a key's `workspacePermissions` only
 * contain workspaces in its own organization — see `authenticateApiKeyFromHeaders`), so a legitimate
 * workspace match already implies the same organization. Re-checking it here is defense-in-depth: it
 * keeps this decision correct on its own even if that upstream invariant ever regresses.
 */
export const hasApiKeyImplicitFeedbackDirectoryAccess = (
  authentication: TAuthenticationApiKey,
  directoryOrganizationId: string,
  workspaceIds: string[],
  requiredPermission: TFeedbackRecordsGatewayPermission
): boolean => {
  // The key must belong to the directory's organization for either path to grant access.
  if (authentication.organizationId !== directoryOrganizationId) {
    return false;
  }

  const orgAccessControl = authentication.organizationAccess?.accessControl;
  if (orgAccessControl?.write) {
    return true;
  }
  if (orgAccessControl?.read && requiredPermission === "read") {
    return true;
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
