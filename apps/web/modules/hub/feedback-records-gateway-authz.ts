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
 * Organization-level access control (`organizationAccess.accessControl`) only grants access to
 * directories in the API key's OWN organization. Without the org match, a key with org-level
 * read/write in organization A would satisfy the check for a directory in organization B — a
 * cross-tenant access path (ENG-1980). The workspace-permission path is already org-scoped by
 * construction: a key's `workspacePermissions` only contain workspaces in its own organization, so
 * the target directory's `workspaceIds` can never match a key from another organization.
 */
export const hasApiKeyImplicitFeedbackDirectoryAccess = (
  authentication: TAuthenticationApiKey,
  directoryOrganizationId: string,
  workspaceIds: string[],
  requiredPermission: TFeedbackRecordsGatewayPermission
): boolean => {
  if (authentication.organizationId === directoryOrganizationId) {
    const orgAccessControl = authentication.organizationAccess?.accessControl;
    if (orgAccessControl?.write) {
      return true;
    }
    if (orgAccessControl?.read && requiredPermission === "read") {
      return true;
    }
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
