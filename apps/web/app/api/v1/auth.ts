import { responses } from "@/app/lib/api/response";
import { hashApiKey } from "@/modules/api/v2/management/lib/utils";
import { getApiKeyWithPermissions } from "@/modules/organization/settings/api-keys/lib/api-key";
import { NextRequest } from "next/server";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";

export const authenticateRequest = async (request: NextRequest): Promise<TAuthenticationApiKey | null> => {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) return null;

  // Get API key with permissions
  const apiKeyData = await getApiKeyWithPermissions(apiKey);
  if (!apiKeyData) return null;

  // In the route handlers, we'll do more specific permission checks
  const environmentIds = apiKeyData.apiKeyEnvironments.map((env) => env.environmentId);
  if (environmentIds.length === 0) return null;

  const hashedApiKey = hashApiKey(apiKey);
  const authentication: TAuthenticationApiKey = {
    type: "apiKey",
    environmentPermissions: apiKeyData.apiKeyEnvironments.map((env) => ({
      environmentId: env.environmentId,
      environmentType: env.environment.type,
      permission: env.permission,
      projectId: env.environment.projectId,
      projectName: env.environment.project.name,
    })),
    hashedApiKey,
    apiKeyId: apiKeyData.id,
    organizationId: apiKeyData.organizationId,
    organizationAccess: apiKeyData.organizationAccess,
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
