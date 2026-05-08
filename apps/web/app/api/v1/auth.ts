import { NextRequest } from "next/server";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import {
  DatabaseError,
  InvalidInputError,
  ResourceNotFoundError,
  UniqueConstraintError,
} from "@formbricks/types/errors";
import { responses } from "@/app/lib/api/response";
import { getApiKeyWithPermissions } from "@/modules/organization/settings/api-keys/lib/api-key";

type AuthenticateApiKeyOptions = {
  allowOrganizationOnlyApiKey?: boolean;
};

export const authenticateApiKey = async (
  apiKey: string,
  options: AuthenticateApiKeyOptions = {}
): Promise<TAuthenticationApiKey | null> => {
  const apiKeyData = await getApiKeyWithPermissions(apiKey);
  if (!apiKeyData) return null;

  if (!options.allowOrganizationOnlyApiKey && apiKeyData.apiKeyEnvironments.length === 0) {
    return null;
  }

  // In the route handlers, we'll do more specific permission checks
  const authentication: TAuthenticationApiKey = {
    type: "apiKey",
    environmentPermissions: apiKeyData.apiKeyEnvironments.map((env) => ({
      environmentId: env.environmentId,
      environmentType: env.environment.type,
      permission: env.permission,
      projectId: env.environment.projectId,
      projectName: env.environment.project.name,
    })),
    apiKeyId: apiKeyData.id,
    organizationId: apiKeyData.organizationId,
    organizationAccess: apiKeyData.organizationAccess,
  };

  return authentication;
};

export const authenticateRequest = async (
  request: NextRequest,
  options: AuthenticateApiKeyOptions = {}
): Promise<TAuthenticationApiKey | null> => {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) return null;

  return authenticateApiKey(apiKey, options);
};

export const handleErrorResponse = (error: any): Response => {
  switch (error.message) {
    case "NotAuthenticated":
      return responses.notAuthenticatedResponse();
    case "Unauthorized":
      return responses.unauthorizedResponse();
    default:
      if (error instanceof UniqueConstraintError) {
        return responses.conflictResponse(error.message);
      }
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
