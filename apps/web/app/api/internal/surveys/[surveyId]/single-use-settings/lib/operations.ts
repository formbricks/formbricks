import "server-only";
import { refusalResponse } from "@/app/api/internal/lib/refusal";
import { requireSurveyActionAccess } from "@/app/api/internal/lib/survey-access";
import { problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getSurvey, updateSurvey } from "@/lib/survey/service";
import type { TSurveySingleUseSettingsBody } from "../schemas";
import { serializeSurveySingleUseSettings } from "../serializers";

/**
 * `PUT /api/internal/surveys/{surveyId}/single-use-settings`: switch the survey's link between multi-use
 * and single-use, and its single-use ids between plain and encrypted. Needs `survey.write`, and saves the
 * survey through the same update as the server action it replaces, so its validation applies. Not audited
 * and no budget of its own, as before. A refusal from the update keeps its reason (403 or 422).
 */
export async function updateSingleUseSettingsOperation({
  authentication,
  surveyId,
  body,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  surveyId: string;
  body: TSurveySingleUseSettingsBody;
  requestId: string;
  instance?: string;
}): Promise<Response> {
  const access = await requireSurveyActionAccess({
    authentication,
    surveyId,
    action: "survey.write",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  const survey = await getSurvey(surveyId);
  if (!survey) return problemForbidden(requestId, undefined, instance);

  try {
    const updatedSurvey = await updateSurvey({
      ...survey,
      singleUse: { enabled: body.enabled, isEncrypted: body.isEncrypted },
    });
    return successResponse(serializeSurveySingleUseSettings(updatedSurvey), { requestId });
  } catch (error) {
    const refused = refusalResponse(error, requestId, instance);
    if (refused) return refused;
    throw error;
  }
}
