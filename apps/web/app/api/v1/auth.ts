import { responses } from "@/app/lib/api/response";
import { hashApiKey } from "@/modules/api/v2/management/lib/utils";
import { prisma } from "@formbricks/database";
import { TAPIKeyEnvironmentPermission, TAuthenticationApiKey } from "@formbricks/types/auth";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";

// Permission level required for different HTTP methods
const methodPermissionMap = {
  GET: "read", // Read operations need at least read permission
  POST: "write", // Create operations need at least write permission
  PUT: "write", // Update operations need at least write permission
  DELETE: "manage", // Delete operations need manage permission
  PATCH: "write", // Partial update operations need at least write permission
};

// Get API key with its permissions from a raw API key
export const getApiKeyWithPermissions = async (apiKey: string) => {
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

export const authenticateRequest = async (request: Request): Promise<TAuthenticationApiKey | null> => {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) return null;

  // Get API key with permissions
  const apiKeyData = await getApiKeyWithPermissions(apiKey);
  if (!apiKeyData) return null;

  // For backward compatibility, create auth object with the first environment ID
  // In the route handlers, we'll do more specific permission checks
  const environmentIds = apiKeyData.apiKeyEnvironments.map((env: any) => env.environmentId);
  if (environmentIds.length === 0) return null;

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

  return authentication;
};

export const handleErrorResponse = (error: any): Response => {
  switch (error.message) {
    case "NotAuthenticated":
      return responses.notAuthenticatedResponse();
    case "Unauthorized":
      return responses.unauthorizedResponse();
    default:
      if (
        error instanceof DatabaseError ||
        error instanceof InvalidInputError ||
        error instanceof ResourceNotFoundError
      ) {
        return responses.badRequestResponse(error.message);
      }
      return responses.internalServerErrorResponse("Some error occurred");
  }
};
