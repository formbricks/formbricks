import { NextRequest } from "next/server";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { type ApiErrorResult, handleApiError } from "@/app/lib/api/handle-api-error";
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

export const handleErrorResponse = (error: unknown): ApiErrorResult => {
  const message = error instanceof Error ? error.message : undefined;
  switch (message) {
    case "NotAuthenticated":
      return { response: responses.notAuthenticatedResponse() };
    case "Unauthorized":
      return { response: responses.unauthorizedResponse() };
    default:
      // Delegate to the shared boundary and return its full { response, error } result — not just
      // `.response` — so the wrapper's reportApiError receives the real 5xx error (e.g. a
      // DatabaseError) instead of a synthetic one. Expected 4xx errors keep their status/message.
      return handleApiError(error);
  }
};
