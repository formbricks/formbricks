import { responses } from "@/lib/api/response";
import { getApiKeyFromKey } from "@formbricks/lib/services/apiKey";
import { getEnvironmentResponses } from "@formbricks/lib/services/response";
import { headers } from "next/headers";
import { DatabaseError } from "@formbricks/errors";

export async function GET() {
  const apiKey = headers().get("x-api-key");
  if (!apiKey) {
    return responses.notAuthenticatedResponse();
  }
  let apiKeyData;
  try {
    apiKeyData = await getApiKeyFromKey(apiKey);
    if (!apiKeyData) {
      return responses.notAuthenticatedResponse();
    }
  } catch (error) {
    return responses.notAuthenticatedResponse();
  }

  // get webhooks from database
  try {
    const environmentResponses = await getEnvironmentResponses(apiKeyData.environmentId);
    return responses.successResponse(environmentResponses);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
}
