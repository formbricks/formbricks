import { MAX_OTHER_OPTION_LENGTH } from "@/lib/constants";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { TResponseData } from "@formbricks/types/responses";
import {
  TSurveyQuestion,
  TSurveyQuestionChoice,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";

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
  surveyQuestions,
  responseLanguage,
}: {
  responseData?: TResponseData;
  surveyQuestions: TSurveyQuestion[];
  responseLanguage?: string;
}): string | undefined => {
  if (!responseData) return undefined;
  for (const [questionId, answer] of Object.entries(responseData)) {
    const question = surveyQuestions.find((q) => q.id === questionId);
    if (!question) continue;

    const isMultiChoice =
      question.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti ||
      question.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle;

    if (!isMultiChoice) continue;

    const error = validateAnswer(answer, question.choices, questionId, responseLanguage);
    if (error) return error;
  }

  return undefined;
};

function validateAnswer(
  answer: unknown,
  choices: TSurveyQuestionChoice[],
  questionId: string,
  language?: string
): string | undefined {
  if (typeof answer === "string") {
    return validateOtherOptionLength(answer, choices, questionId, language);
  }

  if (Array.isArray(answer)) {
    for (const item of answer) {
      if (typeof item === "string") {
        const result = validateOtherOptionLength(item, choices, questionId, language);
        if (result) return result;
      }
    }
  }

  return undefined;
}
