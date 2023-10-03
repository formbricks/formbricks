import { responses } from "@/lib/api/response";
import { getEnvironmentResponses } from "@formbricks/lib/response/service";
import { authenticateRequest } from "@/app/api/v1/auth";
import { DatabaseError } from "@formbricks/types/v1/errors";

export async function GET(request: Request) {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const responseArray = await getEnvironmentResponses(authentication.environmentId!);
    return responses.successResponse(responseArray);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
}

// Please use the client API to create a new response
