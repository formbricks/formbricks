import { type Result, err, ok, wrapThrowsAsync } from "@formbricks/types/error-handlers";
import { type ApiErrorResponse } from "@formbricks/types/errors";
import { type TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TAllowedFileExtension, mimeTypes } from "@formbricks/types/storage";
import { TSurveyBlock, TSurveyBlockLogic, TSurveyBlockLogicAction } from "@formbricks/types/surveys/blocks";
import { type TSurveyElement, TSurveyElementChoice } from "@formbricks/types/surveys/elements";
import { type TShuffleOption } from "@formbricks/types/surveys/types";
import { ApiResponse, ApiSuccessResponse } from "@/types/api";

export const cn = (...classes: string[]) => {
  return classes.filter(Boolean).join(" ");
};

export const getSecureRandom = (): number => {
  const u32 = new Uint32Array(1);
  crypto.getRandomValues(u32);
  return u32[0] / 2 ** 32; // Normalized to [0, 1)
};

const shuffle = (array: unknown[]) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(getSecureRandom() * (i + 1));
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
    if (lastElement !== undefined) {
      shuffle(array);
      array.push(lastElement);
    }
  }
  return array;
};

export const getShuffledChoicesIds = (
  choices: TSurveyElementChoice[],
  shuffleOption: TShuffleOption
): string[] => {
  const otherOption = choices.find((choice) => {
    return choice.id === "other";
  });
  const noneOption = choices.find((choice) => {
    return choice.id === "none";
  });

  const shuffledChoices = choices.filter((choice) => choice.id !== "other" && choice.id !== "none");

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
  if (noneOption) {
    shuffledChoices.push(noneOption);
  }

  return shuffledChoices.map((choice) => choice.id);
};

export const calculateElementIdx = (
  survey: TJsEnvironmentStateSurvey,
  currentQustionIdx: number,
  totalCards: number
): number => {
  const questions = getElementsFromSurveyBlocks(survey.blocks);
  const currentQuestion = questions[currentQustionIdx];
  const middleIdx = Math.floor(totalCards / 2);
  const possibleNextBlockIds = getPossibleNextBlocks(survey.blocks, currentQuestion);
  const endingCardIds = survey.endings.map((ending) => ending.id);

  // Convert block IDs to element IDs (get first element of each block)
  const possibleNextQuestionIds = possibleNextBlockIds
    .map((blockId) => getFirstElementIdInBlock(survey, blockId))
    .filter((id): id is string => id !== undefined);

  const getLastQuestionIndex = () => {
    const lastQuestion = questions
      .filter((q) => possibleNextQuestionIds.includes(q.id))
      .sort((a, b) => questions.indexOf(a) - questions.indexOf(b))
      .pop();
    return questions.findIndex((e) => e.id === lastQuestion?.id);
  };

  let elementIdx = currentQustionIdx + 1;
  const lastprevQuestionIdx = getLastQuestionIndex();

  if (lastprevQuestionIdx > 0) elementIdx = Math.min(middleIdx, lastprevQuestionIdx - 1);
  if (possibleNextBlockIds.some((id) => endingCardIds.includes(id))) elementIdx = middleIdx;
  return elementIdx;
};

const getPossibleNextBlocks = (blocks: TSurveyBlock[], element: TSurveyElement): string[] => {
  // In the blocks model, logic is stored at the block level
  const parentBlock = findBlockByElementId(blocks, element.id);
  if (!parentBlock?.logic) return [];

  const possibleBlockIds: string[] = [];

  parentBlock.logic.forEach((logic: TSurveyBlockLogic) => {
    logic.actions.forEach((action: TSurveyBlockLogicAction) => {
      if (action.objective === "jumpToBlock") {
        possibleBlockIds.push(action.target);
      }
    });
  });

  return possibleBlockIds;
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

/**
 * Returns true if the string contains any RTL character.
 * @param text The input string to test
 */
export function isRTL(text: string): boolean {
  const rtlCharRegex = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
  return rtlCharRegex.test(text);
}

export const checkIfSurveyIsRTL = (survey: TJsEnvironmentStateSurvey, languageCode: string): boolean => {
  if (survey.welcomeCard.enabled) {
    const welcomeCardHeadline = survey.welcomeCard.headline?.[languageCode];
    if (welcomeCardHeadline) {
      return isRTL(welcomeCardHeadline);
    }
  }

  const questions = getElementsFromSurveyBlocks(survey.blocks);
  for (const question of questions) {
    const questionHeadline = question.headline[languageCode];

    // the first non-empty question headline is the survey direction
    if (questionHeadline) {
      return isRTL(questionHeadline);
    }
  }

  return false;
};

/**
 * Derives a flat array of elements from the survey's blocks structure.
 * @param blocks The blocks array
 * @returns An array of TSurveyElement (pure elements without block-level properties)
 */
export const getElementsFromSurveyBlocks = (blocks: TSurveyBlock[]): TSurveyElement[] =>
  blocks.flatMap((block) => block.elements);

/**
 * Finds the parent block that contains the specified element ID.
 * Useful for accessing block-level properties like logic and button labels.
 * @param survey The survey object with blocks
 * @param elementId The ID of the element to find
 * @returns The parent block or undefined if not found
 */
export const findBlockByElementId = (blocks: TSurveyBlock[], elementId: string) =>
  blocks.find((block) => block.elements.some((e) => e.id === elementId));

/**
 * Converts a block ID to the first element ID in that block.
 * Used for navigation when logic jumps to a block.
 * @param survey The survey object with blocks
 * @param blockId The block ID to convert
 * @returns The first element ID in the block, or undefined if block not found or empty
 */
export const getFirstElementIdInBlock = (
  survey: TJsEnvironmentStateSurvey,
  blockId: string
): string | undefined => {
  const block = survey.blocks.find((b) => b.id === blockId);
  return block?.elements[0]?.id;
};
