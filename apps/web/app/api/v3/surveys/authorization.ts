import { getV3AuthorizationActor, requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { can } from "@/lib/authorization";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import { getSurvey } from "@/lib/survey/service";
import { resolveV3SurveyResourceVisibility } from "./visibility-context";

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

  // ENG-3282: once survey visibility is enforced, workspace access is necessary but not sufficient —
  // a restricted survey is its owner's and the administrators'. Same 403 body as an unknown id, so a
  // restricted survey's existence is not probeable. Skipped entirely while the marker is off, so a
  // deployment that has not opted in pays no second check.
  if (await isSurveyVisibilityReady()) {
    const actor = getV3AuthorizationActor(authentication);
    const allowed =
      actor !== null &&
      (await can(actor, access === "read" ? "survey.read" : "survey.write", {
        type: "survey",
        id: survey.id,
      }));
    if (!allowed) {
      return {
        survey: null,
        authResult: null,
        response: problemForbidden(requestId, "You are not authorized to access this resource", instance),
      };
    }
  }

  const visibility = await resolveV3SurveyResourceVisibility(
    survey,
    authentication,
    authResult.organizationId
  );

  return { survey, authResult, response: null, visibility };
}
