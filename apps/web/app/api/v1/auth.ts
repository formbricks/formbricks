import { getApiKeyFromKey } from "@formbricks/lib/apiKey/service";
import { TAuthenticationApiKey } from "@formbricks/types/v1/auth";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { responses } from "@/lib/api/response";
import { NextResponse } from "next/server";

export async function authenticateRequest(request: Request): Promise<TAuthenticationApiKey | null> {
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
}

export function handleErrorResponse(error: any): NextResponse {
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
}
