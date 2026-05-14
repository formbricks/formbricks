import { logger } from "@formbricks/logger";
import { TSurvey } from "@formbricks/types/surveys/types";
import { validateSingleUseResponseInput } from "@/app/api/client/[environmentId]/responses/lib/single-use";
import { getOrganizationBillingByEnvironmentId } from "@/app/api/v2/client/[environmentId]/responses/lib/organization";
import { verifyRecaptchaToken } from "@/app/api/v2/client/[environmentId]/responses/lib/recaptcha";
import { TResponseInputV2 } from "@/app/api/v2/client/[environmentId]/responses/types/response";
import { responses } from "@/app/lib/api/response";
import { getOrganizationIdFromEnvironmentId } from "@/lib/utils/helper";
import { getIsSpamProtectionEnabled } from "@/modules/ee/license-check/lib/utils";

export const RECAPTCHA_VERIFICATION_ERROR_CODE = "recaptcha_verification_failed";

export const checkSurveyValidity = async (
  survey: TSurvey,
  environmentId: string,
  responseInput: TResponseInputV2
): Promise<Response | null> => {
  if (survey.environmentId !== environmentId) {
    return responses.badRequestResponse("Survey does not belong to this environment", undefined, true);
  }

  if (survey.status !== "inProgress") {
    return responses.forbiddenResponse("Survey is not accepting submissions", true, {
      surveyId: survey.id,
    });
  }

  const singleUseValidationResult = validateSingleUseResponseInput(survey, environmentId, responseInput);
  if (singleUseValidationResult) {
    if ("response" in singleUseValidationResult) {
      return singleUseValidationResult.response;
    }
    responseInput.singleUseId = singleUseValidationResult.singleUseId;
  }

  if (survey.recaptcha?.enabled) {
    if (!responseInput.recaptchaToken) {
      logger.error("Missing recaptcha token");
      return responses.badRequestResponse(
        "Missing recaptcha token",
        {
          code: RECAPTCHA_VERIFICATION_ERROR_CODE,
        },
        true
      );
    }
    const billing = await getOrganizationBillingByEnvironmentId(environmentId);

    if (!billing) {
      return responses.notFoundResponse("Organization", null);
    }

    const organizationId = await getOrganizationIdFromEnvironmentId(environmentId);
    const isSpamProtectionEnabled = await getIsSpamProtectionEnabled(organizationId);

    if (!isSpamProtectionEnabled) {
      logger.error("Spam protection is not enabled for this organization");
    }

    const isPassed = await verifyRecaptchaToken(responseInput.recaptchaToken, survey.recaptcha.threshold);
    if (!isPassed) {
      return responses.badRequestResponse(
        "reCAPTCHA verification failed",
        {
          code: RECAPTCHA_VERIFICATION_ERROR_CODE,
        },
        true
      );
    }
  }

  return null;
};
