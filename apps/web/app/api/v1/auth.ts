import { responses } from "@/app/lib/api/response";
import { getApiKeyFromKey } from "@formbricks/lib/apiKey/service";
import { getApiKeyFromKeyWithOrganization } from "@formbricks/lib/apiKey/service";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { AuthenticationError } from "@formbricks/types/errors";

export const authenticateRequest = async (request: Request): Promise<TAuthenticationApiKey | null> => {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const apiKeyData = await getApiKeyFromKey(apiKey);
    if (apiKeyData) {
      const authentication: TAuthenticationApiKey = {
        type: "apiKey",
        environmentId: apiKeyData.environmentId,
      };
      return authentication;
    }
    return null;
  }
  return null;
};

export const getApiKeyDataOrFail = async (request: Request) => {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    throw new AuthenticationError("Missing Api Key header");
  }

  const apiKeyData = await getApiKeyFromKeyWithOrganization(apiKey);

  if (!apiKeyData) {
    throw new AuthenticationError("Missing Api Key");
  }

  return { type: "apiKey" as TAuthenticationApiKey["type"], ...apiKeyData };
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
