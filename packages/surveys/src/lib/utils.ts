import { ApiResponse, ApiSuccessResponse } from "@/types/api";
import { TAllowedFileExtension, mimeTypes } from "@formbricks/types/common";
import { type Result, err, ok, wrapThrowsAsync } from "@formbricks/types/error-handlers";
import { type ApiErrorResponse } from "@formbricks/types/errors";
import { type TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import {
  type TShuffleOption,
  type TSurveyLogic,
  type TSurveyLogicAction,
  type TSurveyQuestion,
  type TSurveyQuestionChoice,
} from "@formbricks/types/surveys/types";

export const cn = (...classes: string[]) => {
  return classes.filter(Boolean).join(" ");
};

const shuffle = (array: unknown[]) => {
  for (let i = 0; i < array.length; i++) {
    const j = Math.floor(Math.random() * (i + 1)); // NOSONAR typescript:S2245 // Math.random() is not used in a security context
    [array[i], array[j]] = [array[j], array[i]];
  }
};

export const getShuffledRowIndices = (n: number, shuffleOption: TShuffleOption): number[] => {
  // Create an array with numbers from 0 to n-1
  const array = Array.from(Array(n).keys());

  if (shuffleOption === "all") {
    shuffle(array);
  } else if (shuffleOption === "exceptLast") {
    const lastElement = array.pop();
    if (lastElement) {
      shuffle(array);
      array.push(lastElement);
    }
  }
  return array;
};

export const getShuffledChoicesIds = (
  choices: TSurveyQuestionChoice[],
  shuffleOption: TShuffleOption
): string[] => {
  const otherOption = choices.find((choice) => {
    return choice.id === "other";
  });

  const shuffledChoices = otherOption ? [...choices.filter((choice) => choice.id !== "other")] : [...choices];

  if (shuffleOption === "all") {
    shuffle(shuffledChoices);
  }
  if (shuffleOption === "exceptLast") {
    const lastElement = shuffledChoices.pop();
    if (lastElement) {
      shuffle(shuffledChoices);
      shuffledChoices.push(lastElement);
    }
  }

  if (otherOption) {
    shuffledChoices.push(otherOption);
  }

  return shuffledChoices.map((choice) => choice.id);
};

export const calculateElementIdx = (
  survey: TJsEnvironmentStateSurvey,
  currentQustionIdx: number,
  totalCards: number
): number => {
  const currentQuestion = survey.questions[currentQustionIdx];
  const middleIdx = Math.floor(totalCards / 2);
  const possibleNextQuestions = getPossibleNextQuestions(currentQuestion);
  const endingCardIds = survey.endings.map((ending) => ending.id);
  const getLastQuestionIndex = () => {
    const lastQuestion = survey.questions
      .filter((q) => possibleNextQuestions.includes(q.id))
      .sort((a, b) => survey.questions.indexOf(a) - survey.questions.indexOf(b))
      .pop();
    return survey.questions.findIndex((e) => e.id === lastQuestion?.id);
  };

  let elementIdx = currentQustionIdx + 1;
  const lastprevQuestionIdx = getLastQuestionIndex();

  if (lastprevQuestionIdx > 0) elementIdx = Math.min(middleIdx, lastprevQuestionIdx - 1);
  if (possibleNextQuestions.some((id) => endingCardIds.includes(id))) elementIdx = middleIdx;
  return elementIdx;
};

const getPossibleNextQuestions = (question: TSurveyQuestion): string[] => {
  if (!question.logic) return [];

  const possibleDestinations: string[] = [];

  question.logic.forEach((logic: TSurveyLogic) => {
    logic.actions.forEach((action: TSurveyLogicAction) => {
      if (action.objective === "jumpToQuestion") {
        possibleDestinations.push(action.target);
      }
    });
  });

  return possibleDestinations;
};

export const isFulfilled = <T>(val: PromiseSettledResult<T>): val is PromiseFulfilledResult<T> => {
  return val.status === "fulfilled";
};

export const isRejected = <T>(val: PromiseSettledResult<T>): val is PromiseRejectedResult => {
  return val.status === "rejected";
};

export const makeRequest = async <T>(
  appUrl: string,
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  data?: unknown
): Promise<Result<T, ApiErrorResponse>> => {
  const url = new URL(appUrl + endpoint);
  const body = data ? JSON.stringify(data) : undefined;

  const res = await wrapThrowsAsync(fetch)(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });

  // TODO: Only return api error response relevant keys
  if (!res.ok) return err(res.error as unknown as ApiErrorResponse);

  const response = res.data;
  const json = (await response.json()) as ApiResponse;

  if (!response.ok) {
    const errorResponse = json as ApiErrorResponse;
    return err({
      code: errorResponse.code === "forbidden" ? "forbidden" : "network_error",
      status: response.status,
      message: errorResponse.message || "Something went wrong",
      url,
      ...(Object.keys(errorResponse.details ?? {}).length > 0 && { details: errorResponse.details }),
    });
  }

  const successResponse = json as ApiSuccessResponse<T>;
  return ok(successResponse.data);
};

export const getDefaultLanguageCode = (survey: TJsEnvironmentStateSurvey): string | undefined => {
  const defaultSurveyLanguage = survey.languages.find((surveyLanguage) => {
    return surveyLanguage.default;
  });
  if (defaultSurveyLanguage) return defaultSurveyLanguage.language.code;
};

// Function to convert file extension to its MIME type
export const getMimeType = (extension: TAllowedFileExtension): string => mimeTypes[extension];
