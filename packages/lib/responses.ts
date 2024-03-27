import { TResponse } from "@formbricks/types/responses";
import { TSurvey, TSurveyQuestionType } from "@formbricks/types/surveys";

import { getLocalizedValue } from "./i18n/utils";

export const getQuestionResponseMapping = (
  survey: TSurvey,
  response: TResponse
): { question: string; answer: string | string[]; type: TSurveyQuestionType }[] => {
  const questionResponseMapping: {
    question: string;
    answer: string | string[];
    type: TSurveyQuestionType;
  }[] = [];

  for (const question of survey.questions) {
    const answer = response.data[question.id];

    const getAnswer = () => {
      if (!answer) return "";
      else {
        if (question.type === "fileUpload") {
          if (typeof answer === "string") {
            return [answer];
          } else {
            return answer as string[];
            // as array
          }
        } else {
          return answer.toString();
        }
      }
    };

    questionResponseMapping.push({
      question: getLocalizedValue(question.headline, "default"),
      answer: getAnswer(),
      type: question.type,
    });
  }

  return questionResponseMapping;
};
