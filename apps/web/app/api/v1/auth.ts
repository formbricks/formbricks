import { responses } from "@/app/lib/api/response";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getEnvironmentIdFromApiKey } from "./lib/api-key";

export const authenticateRequest = async (request: Request): Promise<TAuthenticationApiKey | null> => {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const environmentId = await getEnvironmentIdFromApiKey(apiKey);
    if (environmentId) {
      const authentication: TAuthenticationApiKey = {
        type: "apiKey",
        environmentId,
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
