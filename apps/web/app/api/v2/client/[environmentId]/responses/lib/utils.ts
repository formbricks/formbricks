import { getOrganizationBillingByEnvironmentId } from "@/app/api/v2/client/[environmentId]/responses/lib/organization";
import { verifyRecaptchaToken } from "@/app/api/v2/client/[environmentId]/responses/lib/recaptcha";
import { TResponseInputV2 } from "@/app/api/v2/client/[environmentId]/responses/types/response";
import { responses } from "@/app/lib/api/response";
import { ENCRYPTION_KEY } from "@/lib/constants";
import { symmetricDecrypt } from "@/lib/crypto";
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

  if (survey.type === "link" && survey.singleUse?.enabled) {
    if (!responseInput.singleUseId) {
      return responses.badRequestResponse("Missing single use id", {
        surveyId: survey.id,
        environmentId,
      });
    }

    if (!responseInput.meta?.url) {
      return responses.badRequestResponse("Missing or invalid URL in response metadata", {
        surveyId: survey.id,
        environmentId,
      });
    }

    let url;
    try {
      url = new URL(responseInput.meta.url);
    } catch (error) {
      return responses.badRequestResponse("Invalid URL in response metadata", {
        surveyId: survey.id,
        environmentId,
        error: error.message,
      });
    }
    const suId = url.searchParams.get("suId");
    if (!suId) {
      return responses.badRequestResponse("Missing single use id", {
        surveyId: survey.id,
        environmentId,
      });
    }

    if (survey.singleUse.isEncrypted) {
      const decryptedSuId = symmetricDecrypt(suId, ENCRYPTION_KEY);
      if (decryptedSuId !== responseInput.singleUseId) {
        return responses.badRequestResponse("Invalid single use id", {
          surveyId: survey.id,
          environmentId,
        });
      }
    } else if (responseInput.singleUseId !== suId) {
      return responses.badRequestResponse("Invalid single use id", {
        surveyId: survey.id,
        environmentId,
      });
    }
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

    const isSpamProtectionEnabled = await getIsSpamProtectionEnabled(billing.plan);

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
