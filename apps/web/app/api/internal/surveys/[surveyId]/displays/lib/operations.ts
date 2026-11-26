import "server-only";
import { logger } from "@formbricks/logger";
import { requireSurveyActionAccess } from "@/app/api/internal/lib/survey-access";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getDisplaysBySurveyIdWithContact } from "@/lib/display/service";
import { serializeSurveyDisplay } from "../serializers";

/**
 * `GET /api/internal/surveys/{surveyId}/displays?limit=&offset=`: a page of the survey's displays to known
 * contacts, newest first, for the Summary page's Impressions tab. It asks `survey.response_read` on the
 * survey, as the server action it replaces did, so a restricted survey (ENG-3282) and an unknown id answer
 * the same 403.
 */
export async function listSurveyDisplaysOperation({
  authentication,
  surveyId,
  limit,
  offset,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  surveyId: string;
  limit: number;
  offset: number;
  requestId: string;
  instance: string;
}): Promise<Response> {
  const access = await requireSurveyActionAccess({
    authentication,
    surveyId,
    action: "survey.response_read",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  try {
    const displays = await getDisplaysBySurveyIdWithContact(surveyId, limit, offset);
    return successResponse(displays.map(serializeSurveyDisplay), { requestId, cache: "private, no-store" });
  } catch (error) {
    return mapV3ThrownError(error, {
      log: logger.withContext({ requestId }),
      requestId,
      instance,
      operation: "survey-displays.list",
    });
  }
}
