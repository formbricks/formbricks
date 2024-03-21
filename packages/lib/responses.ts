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
          return processResponseData(answer);
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

export const processResponseData = (
  responseData: string | number | string[] | Record<string, string>
): string => {
  if (!responseData) return "";
  if (typeof responseData === "string") {
    return responseData;
  } else if (typeof responseData === "number") {
    return responseData.toString();
  } else if (Array.isArray(responseData)) {
    return responseData.join("; ");
  } else {
    const formattedString = Object.entries(responseData)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    return formattedString;
  }
};
