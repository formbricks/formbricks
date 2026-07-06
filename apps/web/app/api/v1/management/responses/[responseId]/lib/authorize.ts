import { responses } from "@/app/lib/api/response";
import { TApiV1Authentication } from "@/app/lib/api/with-api-logging";
import { getResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";

/**
 * Loads a response and its survey and verifies the caller's API key has the
 * required permission on the survey's workspace. Shared by the response
 * management endpoints (GET/PUT/DELETE) and the prefill-link endpoint.
 */
export async function fetchAndAuthorizeResponse(
  responseId: string,
  authentication: TApiV1Authentication | undefined,
  requiredPermission: "GET" | "PUT" | "DELETE"
) {
  if (!authentication || !("apiKeyId" in authentication)) {
    return { error: responses.notAuthenticatedResponse() };
  }

  const response = await getResponse(responseId);
  if (!response) {
    return { error: responses.notFoundResponse("Response", responseId) };
  }

  const survey = await getSurvey(response.surveyId);
  if (!survey) {
    return { error: responses.notFoundResponse("Survey", response.surveyId, true) };
  }

  if (!hasPermission(authentication.workspacePermissions, survey.workspaceId, requiredPermission)) {
    return { error: responses.unauthorizedResponse() };
  }

  return { response, survey };
}
