import { NextRequest } from "next/server";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import {
  DatabaseError,
  InvalidInputError,
  ResourceNotFoundError,
  UniqueConstraintError,
} from "@formbricks/types/errors";
import { responses } from "@/app/lib/api/response";
import {
  type AuthenticateApiKeyOptions,
  authenticateApiKeyFromHeaders,
} from "@/modules/api/lib/api-key-auth";

export const authenticateRequest = async (
  request: NextRequest,
  options: AuthenticateApiKeyOptions = {}
): Promise<TAuthenticationApiKey | null> => {
  return await authenticateApiKeyFromHeaders(request.headers, options);
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
      if (error instanceof ResourceNotFoundError) {
        return responses.notFoundResponse(error.resourceType, error.resourceId);
      }
      if (error instanceof DatabaseError || error instanceof InvalidInputError) {
        return responses.badRequestResponse(error.message);
      }
      return responses.internalServerErrorResponse("Some error occurred");
  }
};
