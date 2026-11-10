import "server-only";
import { InvalidInputError, TooManyRequestsError } from "@formbricks/types/errors";
import { getEmailTemplateHtml } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/emailTemplate";
import { requireSurveyActionAccess } from "@/app/api/internal/lib/survey-access";
import { rateLimitedResponse } from "@/app/api/v3/lib/operation-rate-limit";
import {
  problemBadGateway,
  problemForbidden,
  problemUnauthorized,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getSurvey } from "@/lib/survey/service";
import { getUser } from "@/lib/user/service";
import { getOrganizationIdFromSurveyId } from "@/lib/utils/helper";
import { getOrganizationLogoUrl } from "@/modules/ee/whitelabel/email-customization/lib/organization";
import { sendEmbedSurveyPreviewEmail } from "@/modules/email";

/**
 * `POST /api/internal/surveys/{surveyId}/preview-emails`: email the caller the survey as an email embed,
 * from the share modal's Email tab, with the organization's logo. `survey.read` first, so a forbidden
 * survey and a missing one answer alike (ENG-3282). Rate-limited per sender by the email service itself
 * (and by the wrapper per user), as the server action it replaces was. Not audited: it changes nothing.
 *
 * 202 with whether an email went out: none does on an instance without SMTP.
 */
export async function sendSurveyPreviewEmailOperation({
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
    action: "survey.read",
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  const user = await getUser(access.userId);
  if (!user) return problemUnauthorized(requestId, "Session required", instance);

  // Throws `ResourceNotFoundError` for a survey deleted since the check: the wrapper's uniform 403.
  const organizationId = await getOrganizationIdFromSurveyId(surveyId);
  const organizationLogoUrl = await getOrganizationLogoUrl(organizationId);

  const survey = await getSurvey(surveyId);
  if (!survey) return problemForbidden(requestId, undefined, instance);

  // The embed with its links pointing at the live survey rather than its preview.
  const rawEmailHtml = await getEmailTemplateHtml(surveyId, user.locale);
  const emailHtml = rawEmailHtml
    .replaceAll("?preview=true&amp;", "?")
    .replaceAll("?preview=true&;", "?")
    .replaceAll("?preview=true", "");

  let emailSent: boolean;
  try {
    emailSent = await sendEmbedSurveyPreviewEmail({
      to: user.email,
      innerHtml: emailHtml,
      workspaceId: survey.workspaceId,
      locale: user.locale,
      actorUserId: user.id,
      logoUrl: organizationLogoUrl || "",
      surveyId: survey.id,
      organizationId,
    });
  } catch (error) {
    // The sender's email budget is spent: the limiter's message, which says when to try again.
    if (error instanceof TooManyRequestsError) return rateLimitedResponse(error, { requestId, instance });
    // The SMTP server refused the message ("Incorrect SMTP credentials"), which the tab shows.
    if (error instanceof InvalidInputError) return problemBadGateway(requestId, error.message, instance);
    throw error;
  }

  return successResponse({ emailSent }, { requestId, status: 202 });
}
