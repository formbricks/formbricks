import { NextRequest } from "next/server";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { handleApiError } from "@/app/lib/api/handle-api-error";
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
      // Delegate to the shared boundary: expected 4xx errors keep their status/message; a
      // DatabaseError or anything unexpected becomes a generic 500 (never echo internals).
      return handleApiError(error).response;
  }
};
