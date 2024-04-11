import { TResponse } from "@formbricks/types/responses";
import { TI18nString, TSurvey, TSurveyQuestion, TSurveyQuestionType } from "@formbricks/types/surveys";

export function isI18nObject(obj: any): obj is TI18nString {
  return typeof obj === "object" && obj !== null && Object.keys(obj).includes("default");
}

export const getLocalizedValue = (value: TI18nString | undefined, languageId: string): string => {
  if (!value) {
    return "";
  }
  if (isI18nObject(value)) {
    if (value[languageId]) {
      return value[languageId];
    }
    return "";
  }
  return "";
};

export const processResponseData = (
  responseData: string | number | string[] | Record<string, string>
): string => {
  if (!responseData) return "";

  switch (typeof responseData) {
    case "string":
      return responseData;

    case "number":
      return responseData.toString();

    case "object":
      if (Array.isArray(responseData)) {
        return responseData.join("; ");
      } else {
        const formattedString = Object.entries(responseData)
          .filter(([_, value]) => value.trim() !== "") // Filter out entries with empty string values
          .map(([key, value]) => `${key}: ${value}`)
          .join("\n");
        return formattedString;
      }

    default:
      return "";
  }
};

// function to convert response value of type string | number | string[] or Record<string, string> to string | string[]
export const convertResponseValue = (
  answer: string | number | string[] | Record<string, string>,
  question: TSurveyQuestion
): string | string[] => {
  if (!answer) return "";
  else {
    switch (question.type) {
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

  for (const question of survey.questions) {
    const answer = response.data[question.id];

    questionResponseMapping.push({
      question: getLocalizedValue(question.headline, "default"),
      response: convertResponseValue(answer, question),
      type: question.type,
    });
  }

  return questionResponseMapping;
};

export const getOriginalFileNameFromUrl = (fileURL: string) => {
  try {
    const fileNameFromURL = fileURL.startsWith("/storage/")
      ? fileURL.split("/").pop()
      : new URL(fileURL).pathname.split("/").pop();

    const fileExt = fileNameFromURL?.split(".").pop() ?? "";
    const originalFileName = fileNameFromURL?.split("--fid--")[0] ?? "";
    const fileId = fileNameFromURL?.split("--fid--")[1] ?? "";

    if (!fileId) {
      const fileName = originalFileName ? decodeURIComponent(originalFileName || "") : "";
      return fileName;
    }

    const fileName = originalFileName ? decodeURIComponent(`${originalFileName}.${fileExt}` || "") : "";
    return fileName;
  } catch (error) {
    console.error(`Error parsing file URL: ${error}`);
  }
};
