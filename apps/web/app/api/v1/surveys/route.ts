import { responses } from "@/lib/api/response";
import { DatabaseError } from "@formbricks/types/v1/errors";
import { getApiKeyFromKey } from "@formbricks/lib/services/apiKey";
import { getSurveys } from "@formbricks/lib/services/survey";
import { headers } from "next/headers";

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

  // get surveys from database
  try {
    const surveys = await getSurveys(apiKeyData.environmentId);
    return responses.successResponse(surveys);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
}
