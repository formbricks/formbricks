import { getEnvironmentIdFromApiKey } from "@/app/api/v1/lib/api-key";
import { responses } from "@/app/lib/api/response";
import { hashApiKey } from "@/modules/api/v2/management/lib/utils";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";

export const authenticateRequest = async (request: Request): Promise<TAuthenticationApiKey | null> => {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const environmentId = await getEnvironmentIdFromApiKey(apiKey);
    if (environmentId) {
      const hashedApiKey = hashApiKey(apiKey);
      const authentication: TAuthenticationApiKey = {
        type: "apiKey",
        environmentId,
        hashedApiKey,
      };
      return authentication;
    }
    return null;
  }
  return null;
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
