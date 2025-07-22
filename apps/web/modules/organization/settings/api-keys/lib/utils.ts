import { TFnType } from "@tolgee/react";
import { TAPIKeyEnvironmentPermission } from "@formbricks/types/auth";

// Permission level required for different HTTP methods
const methodPermissionMap = {
  GET: "read", // Read operations need at least read permission
  POST: "write", // Create operations need at least write permission
  PUT: "write", // Update operations need at least write permission
  PATCH: "write", // Partial update operations need at least write permission
  DELETE: "manage", // Delete operations need manage permission
};

// Check if API key has sufficient permission for the requested environment and method
export const hasPermission = (
  permissions: TAPIKeyEnvironmentPermission[],
  environmentId: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
): boolean => {
  if (!permissions) return false;

  // Find the environment permission entry for this environment
  const environmentPermission = permissions.find((permission) => permission.environmentId === environmentId);

  if (!environmentPermission) return false;

  // Get required permission level for this method
  const requiredPermission = methodPermissionMap[method];

  // Check if the API key has sufficient permission
  switch (environmentPermission.permission) {
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

export const getOrganizationAccessKeyDisplayName = (key: string, t: TFnType) => {
  switch (key) {
    case "accessControl":
      return t("environments.project.api_keys.access_control");
    default:
      return key;
  }
};
