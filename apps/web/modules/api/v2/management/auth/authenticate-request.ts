import { hashApiKey } from "@/modules/api/v2/management/lib/utils";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { prisma } from "@formbricks/database";
import { TAPIKeyEnvironmentPermission, TAuthenticationApiKey } from "@formbricks/types/auth";
import { Result, err, ok } from "@formbricks/types/error-handlers";

// Permission level required for different HTTP methods
const methodPermissionMap = {
  GET: "read", // Read operations need at least read permission
  POST: "write", // Create operations need at least write permission
  PUT: "write", // Update operations need at least write permission
  PATCH: "write", // Partial update operations need at least write permission
  DELETE: "manage", // Delete operations need manage permission
};

// Get API key with its permissions from a raw API key
const getApiKeyWithPermissions = async (apiKey: string) => {
  const hashedKey = hashApiKey(apiKey);

  // Look up the API key in the new structure
  const apiKeyData = await prisma.apiKey.findUnique({
    where: {
      hashedKey,
    },
    include: {
      apiKeyEnvironments: {
        include: {
          environment: true,
        },
      },
    },
  });

  if (!apiKeyData) return null;

  // Update the last used timestamp
  await prisma.apiKey.update({
    where: {
      id: apiKeyData.id,
    },
    data: {
      lastUsedAt: new Date(),
    },
  });

  return apiKeyData;
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
  const requiredPermission = methodPermissionMap[method as keyof typeof methodPermissionMap] || "manage";

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

export const authenticateRequest = async (
  request: Request
): Promise<Result<TAuthenticationApiKey, ApiErrorResponseV2>> => {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) return err({ type: "unauthorized" });

  const apiKeyData = await getApiKeyWithPermissions(apiKey);
  if (!apiKeyData) return err({ type: "unauthorized" });

  const hashedApiKey = hashApiKey(apiKey);

  const authentication: TAuthenticationApiKey = {
    type: "apiKey",
    environmentPermissions: apiKeyData.apiKeyEnvironments.map((env) => ({
      environmentId: env.environmentId,
      permission: env.permission,
    })),
    hashedApiKey,
    apiKeyId: apiKeyData.id,
    organizationId: apiKeyData.organizationId,
  };
  return ok(authentication);
};
