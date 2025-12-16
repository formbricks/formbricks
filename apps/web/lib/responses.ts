import { TResponse, TResponseDataValue } from "@formbricks/types/responses";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { parseRecallInfo } from "@/lib/utils/recall";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { getLanguageCode, getLocalizedValue } from "./i18n/utils";

// function to convert response value of type string | number | string[] or Record<string, string> to string | string[]
export const convertResponseValue = (
  answer: TResponseDataValue,
  element: TSurveyElement
): string | string[] => {
  switch (element.type) {
    case "ranking":
    case "fileUpload":
      if (typeof answer === "string") {
        return [answer];
      } else return answer as string[];

    case "pictureSelection":
      if (typeof answer === "string") {
        const imageUrl = element.choices.find((choice) => choice.id === answer)?.imageUrl;
        return imageUrl ? [imageUrl] : [];
      } else if (Array.isArray(answer)) {
        return answer
          .map((answerId) => element.choices.find((choice) => choice.id === answerId)?.imageUrl)
          .filter((url): url is string => url !== undefined);
      } else return [];

    default:
      return processResponseData(answer);
  }
};

export const getElementResponseMapping = (
  survey: TSurvey,
  response: TResponse
): { element: string; response: string | string[]; type: TSurveyElementTypeEnum }[] => {
  const elementResponseMapping: {
    element: string;
    response: string | string[];
    type: TSurveyElementTypeEnum;
  }[] = [];
  const responseLanguageCode = getLanguageCode(survey.languages, response.language);

  const elements = getElementsFromBlocks(survey.blocks);

  for (const element of elements) {
    const answer = response.data[element.id];

    elementResponseMapping.push({
      element: getTextContent(
        parseRecallInfo(getLocalizedValue(element.headline, responseLanguageCode ?? "default"), response.data)
      ),
      response: convertResponseValue(answer, element),
      type: element.type,
    });
  }

  return elementResponseMapping;
};

export const processResponseData = (responseData: TResponseDataValue): string => {
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
