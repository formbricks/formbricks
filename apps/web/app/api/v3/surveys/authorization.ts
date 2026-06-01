import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getSurvey } from "@/lib/survey/service";

export async function getAuthorizedV3Survey(params: {
  surveyId: string;
  authentication: TV3Authentication;
  access: "read" | "readWrite";
  requestId: string;
  instance: string;
}) {
  const { surveyId, authentication, access, requestId, instance } = params;
  const survey = await getSurvey(surveyId);

  if (!survey) {
    return {
      survey: null,
      authResult: null,
      response: problemForbidden(requestId, "You are not authorized to access this resource", instance),
    };
  }

  const authResult = await requireV3WorkspaceAccess(
    authentication,
    survey.workspaceId,
    access,
    requestId,
    instance
  );

  if (authResult instanceof Response) {
    return { survey: null, authResult: null, response: authResult };
  }

  return { survey, authResult, response: null };
}
