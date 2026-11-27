import "server-only";
import { getEmailTemplateHtml } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/emailTemplate";
import { requireSurveyActionAccess } from "@/app/api/internal/lib/survey-access";
import { problemUnauthorized, successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getUser } from "@/lib/user/service";
import type { TSurveyEmailEmbedResource } from "../serializers";

/**
 * `GET /api/internal/surveys/{surveyId}/email-embed`: the survey rendered as an email body, in the caller's
 * locale, for the share modal's Email tab. Needs `survey.write`, as the server action it replaces did. A
 * read with no side effects; the HTML is the template's output, unchanged.
 */
export async function getSurveyEmailEmbedOperation({
  authentication,
  surveyId,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  surveyId: string;
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

  const user = await getUser(access.userId);
  if (!user) return problemUnauthorized(requestId, "Session required", instance);

  // Throws `ResourceNotFoundError` for a survey deleted since the check: the wrapper's uniform 403.
  const html = await getEmailTemplateHtml(surveyId, user.locale);
  const resource: TSurveyEmailEmbedResource = { surveyId, html };
  return successResponse(resource, { requestId });
}
