import { TSurvey } from "@formbricks/types/surveys/types";
import { TResponseInputV2 } from "@/app/api/v2/client/[workspaceId]/responses/types/response";
import { responses } from "@/app/lib/api/response";
import { verifyResponseRecaptcha } from "@/modules/api/lib/verify-response-recaptcha";
import { verifyLinkSurveyPinToken } from "@/modules/survey/link/lib/pin-token";
import { resolveSingleUseIdForSurvey } from "@/modules/survey/link/lib/single-use-link";
import { enforceVerifiedEmailGate } from "@/modules/survey/link/lib/verify-email-gate";

export { RECAPTCHA_VERIFICATION_ERROR_CODE } from "@/modules/api/lib/verify-response-recaptcha";

export const checkSurveyValidity = async (
  survey: TSurvey,
  workspaceId: string,
  responseInput: TResponseInputV2
): Promise<Response | null> => {
  if (survey.workspaceId !== workspaceId) {
    return responses.badRequestResponse(
      "Survey is part of another workspace",
      {
        workspaceId,
      },
      true
    );
  }

  if (survey.status !== "inProgress") {
    return responses.forbiddenResponse("Survey is not accepting submissions", true, {
      surveyId: survey.id,
    });
  }

  if (survey.pin && !verifyLinkSurveyPinToken(responseInput.pinAuthToken, survey.id)) {
    return responses.forbiddenResponse("Survey is protected by a PIN", true, { surveyId: survey.id });
  }

  if (survey.type === "link" && survey.singleUse?.enabled) {
    if (!responseInput.singleUseId) {
      return responses.badRequestResponse("Missing single use id", {
        surveyId: survey.id,
        workspaceId,
      });
    }

    if (!responseInput.meta?.url) {
      return responses.badRequestResponse("Missing or invalid URL in response metadata", {
        surveyId: survey.id,
        workspaceId,
      });
    }

    let url;
    try {
      url = new URL(responseInput.meta.url);
    } catch (error) {
      return responses.badRequestResponse("Invalid URL in response metadata", {
        surveyId: survey.id,
        workspaceId,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
    const suId = url.searchParams.get("suId");
    const suToken = url.searchParams.get("suToken");
    if (!suId) {
      return responses.badRequestResponse("Missing single use id", {
        surveyId: survey.id,
        workspaceId,
      });
    }

    const canonicalSingleUseId = resolveSingleUseIdForSurvey({
      surveyId: survey.id,
      isEncrypted: survey.singleUse.isEncrypted,
      suId,
      suToken,
      surface: "client_response_v2",
    });

    if (!canonicalSingleUseId || canonicalSingleUseId !== responseInput.singleUseId) {
      return responses.badRequestResponse("Invalid single use id", {
        surveyId: survey.id,
        workspaceId,
      });
    }

    responseInput.singleUseId = canonicalSingleUseId;
  }

  // Email verification, like the PIN above, must be enforced here and not only in the page renderer:
  // this endpoint is public, so a caller could otherwise submit any `verifiedEmail` they like.
  // Shared with the v1 endpoint so the two versions cannot drift apart.
  const verifiedEmailErrorResponse = enforceVerifiedEmailGate({
    survey,
    responseData: responseInput.data,
    metaUrl: responseInput.meta?.url,
  });
  if (verifiedEmailErrorResponse) {
    return verifiedEmailErrorResponse;
  }

  // Shared with the v1 endpoint so the two versions cannot drift apart again.
  return await verifyResponseRecaptcha({
    survey,
    workspaceId,
    recaptchaToken: responseInput.recaptchaToken,
  });
};
