import "server-only";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getV3AuthorizationActor, requireSessionWorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemForbidden, problemUnauthorized } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { can } from "@/lib/authorization";
import { getSurvey } from "@/lib/survey/service";

export type TSurveyResponseScope = {
  survey: TSurvey;
  workspaceId: string;
  organizationId: string;
  userId: string;
};

/**
 * Authorize a session user to read one survey's responses (`survey.response_read`), for the internal
 * route the survey's Responses and Summary filter calls.
 *
 * The response permission is checked first, on the id alone, as the server action this route replaces did:
 * the resolver denies an unknown id too, so a missing survey, a restricted one (ENG-3282) and one in a
 * workspace the caller can't read all answer the same 403 and ids can't be walked. The survey is then
 * read, and its workspace authorized for `read`, which resolves the organization from the database rather
 * than from the request.
 */
export async function authorizeSurveyResponseAccess({
  authentication,
  surveyId,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  surveyId: string;
  requestId: string;
  instance: string;
}): Promise<Response | TSurveyResponseScope> {
  const actor = getV3AuthorizationActor(authentication);
  if (actor?.type !== "user") {
    return problemUnauthorized(requestId, "Session required", instance);
  }

  if (!(await can(actor, "survey.response_read", { type: "survey", id: surveyId }))) {
    return problemForbidden(requestId, undefined, instance);
  }

  const survey = await getSurvey(surveyId);
  // Deleted between the check and the read.
  if (!survey) return problemForbidden(requestId, undefined, instance);

  const access = await requireSessionWorkspaceAccess(
    authentication,
    survey.workspaceId,
    "read",
    requestId,
    instance
  );
  if (access instanceof Response) return access;

  return {
    survey,
    workspaceId: access.workspaceId,
    organizationId: access.organizationId,
    userId: actor.id,
  };
}
