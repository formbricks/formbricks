import "server-only";
import type { TRequestMeta } from "@/app/api/internal/lib/types";
import { applyIPRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import { problemNotFound, problemUnprocessableContent, successResponse } from "@/app/api/v3/lib/response";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getLinkSurveyOpenForResponses } from "@/modules/survey/link/lib/open-for-responses";
import { createLinkSurveyPinToken } from "@/modules/survey/link/lib/pin-token";
import { getLinkSurveyCustomCss, omitCustomCssSource } from "@/modules/survey/link/lib/respondent-custom-css";
import { getWorkspaceContextForLinkSurvey } from "@/modules/survey/link/lib/workspace";
import type { TLinkSurveyPinVerificationBody } from "../schemas";
import { serializeLinkSurveyPinVerification } from "../serializers";

/** The code a wrong PIN answers with. The PIN screen shows it only as a red border. */
export const INVALID_PIN = "INVALID_PIN";

/**
 * `POST /api/internal/link-survey-pin-verifications`: compare the PIN and, on a match, return the survey.
 * Charged to the client's IP (10 a minute, fail-closed: it is what stops PIN guessing). A survey that is not
 * open to this caller answers 404, the same for every reason and for any PIN (see
 * `getLinkSurveyOpenForResponses`), which the page takes as "re-render". A wrong PIN answers 422.
 */
export async function verifyLinkSurveyPinOperation({
  body,
  ...context
}: TRequestMeta & { body: TLinkSurveyPinVerificationBody }): Promise<Response> {
  const { requestId, instance } = context;
  const limited = await applyIPRateLimitOrRespond(rateLimitConfigs.actions.validateSurveyPin, context);
  if (limited) return limited;

  // Gated before the PIN comparison, so a survey that is not public, or a single-use survey reached without
  // its link, can't be probed for its PIN either.
  const survey = await getLinkSurveyOpenForResponses({
    surveyId: body.surveyId,
    suId: body.suId,
    suToken: body.suToken,
    surface: "link_pin_action",
  });
  if (!survey) return problemNotFound(requestId, "Survey", body.surveyId, instance);

  const originalPin = survey.pin?.toString();
  if (originalPin && originalPin !== body.pin) {
    return problemUnprocessableContent(requestId, INVALID_PIN, {
      instance,
      details: { reason: INVALID_PIN },
    });
  }

  // The survey goes to the respondent's browser: without its stored custom CSS (editable source),
  // with the compiled CSS the link page would otherwise have rendered (ENG-3552). Resolved only after
  // the PIN matched, so a PIN-protected survey's CSS is not readable before it is unlocked.
  const workspaceContext = await getWorkspaceContextForLinkSurvey(survey.workspaceId);
  const customCss = await getLinkSurveyCustomCss({
    workspaceCustomCss: workspaceContext.customCss,
    allowStyleOverwrite: workspaceContext.workspace.styling?.allowStyleOverwrite,
    survey,
  });

  return successResponse(
    serializeLinkSurveyPinVerification({
      // Without the PIN, like the survey the renderer hands out: the respondent just typed it, but the two
      // paths should never disagree about what leaves the server.
      survey: { ...omitCustomCssSource(survey), pin: null },
      customCss,
      pinAuthToken: originalPin ? createLinkSurveyPinToken(survey.id) : undefined,
    }),
    { requestId }
  );
}
