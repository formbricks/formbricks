import { parseRecallInfo } from "@/lib/utils/recall";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey, TSurveyQuestion, TSurveyQuestionType } from "@formbricks/types/surveys/types";
import { getLanguageCode, getLocalizedValue } from "./i18n/utils";

// function to convert response value of type string | number | string[] or Record<string, string> to string | string[]
export const convertResponseValue = (
  answer: string | number | string[] | Record<string, string>,
  question: TSurveyQuestion
): string | string[] => {
  switch (question.type) {
    case "ranking":
    case "fileUpload":
      if (typeof answer === "string") {
        return [answer];
      } else return answer as string[];

    case "pictureSelection":
      if (typeof answer === "string") {
        const imageUrl = question.choices.find((choice) => choice.id === answer)?.imageUrl;
        return imageUrl ? [imageUrl] : [];
      } else if (Array.isArray(answer)) {
        return answer
          .map((answerId) => question.choices.find((choice) => choice.id === answerId)?.imageUrl)
          .filter((url): url is string => url !== undefined);
      } else return [];

    default:
      return processResponseData(answer);
  }
};

export const getQuestionResponseMapping = (
  survey: TSurvey,
  response: TResponse
): { question: string; response: string | string[]; type: TSurveyQuestionType }[] => {
  const questionResponseMapping: {
    question: string;
    response: string | string[];
    type: TSurveyQuestionType;
  }[] = [];
  const responseLanguageCode = getLanguageCode(survey.languages, response.language);

  for (const question of survey.questions) {
    const answer = response.data[question.id];

    questionResponseMapping.push({
      question: parseRecallInfo(
        getLocalizedValue(question.headline, responseLanguageCode ?? "default"),
        response.data
      ),
      response: convertResponseValue(answer, question),
      type: question.type,
    });
  }

  return questionResponseMapping;
};

export const processResponseData = (
  responseData: string | number | string[] | Record<string, string>
): string => {
  switch (typeof responseData) {
    case "string":
      return responseData;

    case "number":
      return responseData.toString();

    case "object":
      if (Array.isArray(responseData)) {
        responseData = responseData
          .filter((item) => item !== null && item !== undefined && item !== "")
          .join("; ");
        return responseData;
      } else {
        const formattedString = Object.entries(responseData)
          .filter(([_, value]) => value !== "")
          .map(([key, value]) => `${key}: ${value}`)
          .join("\n");
        return formattedString;
      }

    default:
      return "";
  }
};
