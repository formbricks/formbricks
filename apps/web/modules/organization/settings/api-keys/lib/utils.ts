import { OrganizationAccessType } from "@formbricks/types/api-key";
import { TAPIKeyWorkspacePermission, TAuthenticationApiKey } from "@formbricks/types/auth";

// Permission level required for different HTTP methods
const methodPermissionMap = {
  GET: "read", // Read operations need at least read permission
  POST: "write", // Create operations need at least write permission
  PUT: "write", // Update operations need at least write permission
  PATCH: "write", // Partial update operations need at least write permission
  DELETE: "manage", // Delete operations need manage permission
};

// Check if API key has sufficient permission for the requested workspace and method
export const hasPermission = (
  permissions: TAPIKeyWorkspacePermission[],
  workspaceId: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
): boolean => {
  if (!permissions) return false;

  // Find the workspace permission entry for this workspace
  const workspacePermission = permissions.find((permission) => permission.workspaceId === workspaceId);

  if (!workspacePermission) return false;

  // Get required permission level for this method
  const requiredPermission = methodPermissionMap[method];

  // Check if the API key has sufficient permission
  switch (workspacePermission.permission) {
    case "manage":
      // Manage permission can do everything
      return true;
    case "write":
      // Write permission can do write and read operations
      return requiredPermission === "write" || requiredPermission === "read";
    case "read":
      // Read permission can only do read operations
      return requiredPermission === "read";
    default:
      return false;
  }
};

// Check if API key has sufficient permission for the requested workspace and method.
export const hasWorkspacePermission = (
  permissions: TAPIKeyWorkspacePermission[],
  workspaceId: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
): boolean => {
  if (!permissions) return false;

  const workspacePermission = permissions.find((p) => p.workspaceId === workspaceId);
  if (!workspacePermission) return false;

  const requiredPermission = methodPermissionMap[method];

  switch (workspacePermission.permission) {
    case "manage":
      return true;
    case "write":
      return requiredPermission === "write" || requiredPermission === "read";
    case "read":
      return requiredPermission === "read";
    default:
      return false;
  }
};

export const hasOrganizationAccess = (
  authentication: TAuthenticationApiKey,
  accessType: OrganizationAccessType
): boolean => {
  const organizationAccess = authentication.organizationAccess?.accessControl;

  switch (accessType) {
    case OrganizationAccessType.Read:
      return organizationAccess?.read === true || organizationAccess?.write === true;
    case OrganizationAccessType.Write:
      return organizationAccess?.write === true;
    default:
      return false;
  }
};
