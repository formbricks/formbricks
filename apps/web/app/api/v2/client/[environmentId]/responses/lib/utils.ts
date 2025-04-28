import { responses } from "@/app/lib/api/response";
import { MAX_OTHER_OPTION_LENGTH } from "@/lib/constants";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { TSurveyQuestionChoice } from "@formbricks/types/surveys/types";

/**
 * Helper function to check if a string value is a valid "other" option
 * @returns BadRequestResponse if the value exceeds the limit, undefined otherwise
 */
export const validateOtherOptionLength = (
  value: string,
  choices: TSurveyQuestionChoice[],
  questionId: string,
  language?: string
): Response | undefined => {
  // Check if this is an "other" option (not in predefined choices)
  const matchingChoice = choices.find(
    (choice) => getLocalizedValue(choice.label, language ?? "default") === value
  );

  // If this is an "other" option with value that's too long, reject the response
  if (!matchingChoice && value.length > MAX_OTHER_OPTION_LENGTH) {
    return responses.badRequestResponse("Other option text is too long", { questionId }, true);
  }
  return undefined;
};
