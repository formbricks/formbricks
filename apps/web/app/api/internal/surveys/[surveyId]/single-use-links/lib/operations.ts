import "server-only";
import { requireSurveyActionAccess } from "@/app/api/internal/lib/survey-access";
import { requireWorkspaceActionAccess } from "@/app/api/internal/lib/workspace-access";
import { successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import {
  generateSurveySingleUseLinkParams,
  generateSurveySingleUseLinkParamsList,
} from "@/lib/utils/single-use-surveys";
import type { TSurveySingleUseLinksBody } from "../schemas";

/**
 * `POST /api/internal/surveys/{surveyId}/single-use-links`: mint signed single-use link parameters for the
 * survey, the share modal's download and copy and the summary's preview. Nothing is stored. The checks of
 * the server action it replaces, in its order: write access to the survey's workspace, then to the survey
 * itself, since the links write responses into it (ENG-3282). Not audited and no budget of its own, as
 * before.
 */
export async function generateSingleUseLinksOperation({
  authentication,
  surveyId,
  body,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  surveyId: string;
  body: TSurveySingleUseLinksBody;
  requestId: string;
  instance?: string;
}): Promise<Response> {
  // Throws `ResourceNotFoundError` for an unknown survey: the wrapper's uniform 403.
  const workspaceId = await getWorkspaceIdFromSurveyId(surveyId);
  const workspaceAccess = await requireWorkspaceActionAccess({
    authentication,
    workspaceId,
    action: "workspace.write",
    requestId,
    instance,
  });
  if (workspaceAccess instanceof Response) return workspaceAccess;

  const surveyAccess = await requireSurveyActionAccess({
    authentication,
    surveyId,
    action: "survey.write",
    requestId,
    instance,
  });
  if (surveyAccess instanceof Response) return surveyAccess;

  const links = body.singleUseId
    ? [generateSurveySingleUseLinkParams(surveyId, false, body.singleUseId)]
    : generateSurveySingleUseLinkParamsList(body.count, surveyId, body.isEncrypted);

  return successResponse(links, { requestId });
}
