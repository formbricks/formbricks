import { verifyRecaptchaToken } from "@/app/api/v2/client/[environmentId]/responses/lib/recaptcha";
import { TResponseInputV2 } from "@/app/api/v2/client/[environmentId]/responses/types/response";
import { responses } from "@/app/lib/api/response";
import { getIsSpamProtectionEnabled } from "@/modules/ee/license-check/lib/utils";
import { logger } from "@formbricks/logger";
import { TSurvey } from "@formbricks/types/surveys/types";

export const RECAPTCHA_VERIFICATION_ERROR_CODE = "recaptcha_verification_failed";

export const checkSurveyValidity = async (
  survey: TSurvey,
  environmentId: string,
  responseInput: TResponseInputV2
): Promise<Response | null> => {
  if (survey.environmentId !== environmentId) {
    return responses.badRequestResponse(
      "Survey is part of another environment",
      {
        "survey.environmentId": survey.environmentId,
        environmentId,
      },
      true
    );
  }

  if (survey.recaptcha?.enabled) {
    const isSpamProtectionEnabled = await getIsSpamProtectionEnabled();
    if (isSpamProtectionEnabled) {
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
    } else {
      logger.error("Spam protection is not enabled for this organization");
    }
  }

  return null;
};
