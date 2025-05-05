import { getOrganizationBillingByEnvironmentId } from "@/app/api/v2/client/[environmentId]/responses/lib/organization";
import { verifyRecaptchaToken } from "@/app/api/v2/client/[environmentId]/responses/lib/recaptcha";
import { TResponseInputV2 } from "@/app/api/v2/client/[environmentId]/responses/types/response";
import { responses } from "@/app/lib/api/response";
import { MAX_OTHER_OPTION_LENGTH } from "@/lib/constants";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getIsSpamProtectionEnabled } from "@/modules/ee/license-check/lib/utils";
import { logger } from "@formbricks/logger";
import { TResponseData } from "@formbricks/types/responses";
import { TSurvey, TSurveyQuestionChoice, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

export const RECAPTCHA_VERIFICATION_ERROR_CODE = "recaptcha_verification_failed";

/**
 * Helper function to check if a string value is a valid "other" option
 * @returns BadRequestResponse if the value exceeds the limit, undefined otherwise
 */
export const validateOtherOptionLength = (
  value: string,
  choices: TSurveyQuestionChoice[],
  questionId: string,
  language?: string
): string | undefined => {
  // Check if this is an "other" option (not in predefined choices)
  const matchingChoice = choices.find(
    (choice) => getLocalizedValue(choice.label, language ?? "default") === value
  );

  // If this is an "other" option with value that's too long, reject the response
  if (!matchingChoice && value.length > MAX_OTHER_OPTION_LENGTH) {
    return questionId;
  }
};

export const validateOtherOptionLengthForMultipleChoice = ({
  responseData,
  survey,
  responseLanguage,
}: {
  responseData: TResponseData;
  survey: TSurvey;
  responseLanguage?: string;
}): string | undefined => {
  // Validate response data for "other" options exceeding character limit
  for (const questionId of Object.keys(responseData)) {
    const question = survey.questions.find((q) => q.id === questionId);
    if (
      question?.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti ||
      question?.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle
    ) {
      const answer = responseData[questionId];

      // Handle single choice responses
      if (typeof answer === "string") {
        return validateOtherOptionLength(answer, question.choices, questionId, responseLanguage);
      }

      // Handle multi-select responses
      else if (Array.isArray(answer)) {
        for (const item of answer) {
          if (typeof item === "string") {
            return validateOtherOptionLength(item, question.choices, questionId, responseLanguage);
          }
        }
      }
    }
  }
};

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
