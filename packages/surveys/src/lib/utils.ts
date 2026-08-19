import { twMerge } from "tailwind-merge";
import { normalizeLanguageCode } from "@formbricks/i18n-utils/src/canonical";
import { type Result, err, ok, wrapThrowsAsync } from "@formbricks/types/error-handlers";
import { type ApiErrorResponse } from "@formbricks/types/errors";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { type TAllowedFileExtension } from "@formbricks/types/storage";
import {
  type TSurveyBlock,
  type TSurveyBlockLogic,
  type TSurveyBlockLogicAction,
} from "@formbricks/types/surveys/blocks";
import { type TSurveyElement, type TSurveyElementChoice } from "@formbricks/types/surveys/elements";
import { type TShuffleOption } from "@formbricks/types/surveys/types";
import { ApiResponse, ApiSuccessResponse } from "@/types/api";

type ClassValue = string | boolean | null | undefined | ClassValue[];
export const cn = (...classes: ClassValue[]): string => {
  return twMerge(
    classes
      .map((className) => (Array.isArray(className) ? cn(...className) : className))
      .filter((className): className is string => typeof className === "string" && className.length > 0)
      .join(" ")
  );
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
  } else if (shuffleOption === "reverseOrderOccasionally") {
    // 50% chance to reverse the entire array
    if (getSecureRandom() < 0.5) {
      array.reverse();
    }
  } else if (shuffleOption === "reverseOrderExceptLast") {
    // 50% chance to reverse all except the last element
    const lastElement = array.pop();
    if (lastElement !== undefined) {
      if (getSecureRandom() < 0.5) {
        array.reverse();
      }
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
  if (shuffleOption === "reverseOrderOccasionally") {
    // 50% chance to reverse the entire list
    if (getSecureRandom() < 0.5) {
      shuffledChoices.reverse();
    }
  }
  if (shuffleOption === "reverseOrderExceptLast") {
    // 50% chance to reverse all except the last element
    const lastElement = shuffledChoices.pop();
    if (lastElement !== undefined) {
      if (getSecureRandom() < 0.5) {
        shuffledChoices.reverse();
      }
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
  survey: TJsWorkspaceStateSurvey,
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

export const getDefaultLanguageCode = (survey: TJsWorkspaceStateSurvey): string | undefined => {
  const defaultSurveyLanguage = survey.languages.find((surveyLanguage) => {
    return surveyLanguage.default;
  });
  if (defaultSurveyLanguage) return defaultSurveyLanguage.language.code;
};

/**
 * Resolves the survey's active language to a real language tag, usable as a `lang` attribute.
 *
 * The renderer tracks the active language as either a stored language code or the sentinel
 * `"default"`. `"default"` is not a language tag and must never reach the DOM, so it is resolved to
 * the code of the survey's default language. Returns `null` when the survey has no languages
 * configured at all: such a survey has no language to declare and should inherit the host
 * document's rather than assert a guess.
 *
 * The code is resolved AGAINST the survey's enabled languages rather than trusted, and falls back to
 * the default language when it does not match one — the same rule the server's `getLanguageCode`
 * applies to `?lang=`. Without that check a stale code declares a language whose content is not
 * being rendered: `getLocalizedValue` falls back to the `default` text, so a screen reader would
 * read English with (say) French pronunciation rules, which is worse than declaring nothing. The
 * offline restore path is the concrete way to get there — it replays a persisted `selectedLanguage`
 * without revalidating it against a survey whose languages may since have changed.
 *
 * Matching is canonical-aware, so a legacy alias (`hi`) resolves to its stored canonical row
 * (`hi-IN`), and the STORED code is returned so the tag always matches the content lookup key.
 */
export const getSurveyLanguageTag = (
  survey: TJsWorkspaceStateSurvey,
  languageCode: string
): string | null => {
  if (languageCode && languageCode !== "default") {
    const requested = normalizeLanguageCode(languageCode) ?? languageCode;
    const configured = survey.languages.find((surveyLanguage) => {
      if (!surveyLanguage.enabled) return false;
      const code = surveyLanguage.language.code;
      return (normalizeLanguageCode(code) ?? code) === requested;
    });
    if (configured) return configured.language.code;
  }
  return getDefaultLanguageCode(survey) ?? null;
};

/**
 * The code the renderer should store for a language the respondent picked.
 *
 * Returns the `"default"` sentinel when the pick IS the survey's default language, so selecting the
 * default records the same thing as never touching the switcher — `survey.tsx` resolves that sentinel
 * to the default language's stored code when it writes `response.language`.
 *
 * Both sides are compared canonically. The option list is deduped by canonical code and keeps the
 * canonical row, so a survey whose default row holds a legacy alias (`hi`) shows `hi-IN`; comparing
 * the raw strings would miss that match and store a concrete code where the sentinel belongs, making
 * the two paths disagree about the same choice.
 */
export const resolveSelectedLanguageCode = (languageCode: string, defaultLanguageCode?: string): string => {
  if (!defaultLanguageCode) return languageCode;
  const canonical = (code: string): string => normalizeLanguageCode(code) ?? code;
  return canonical(languageCode) === canonical(defaultLanguageCode) ? "default" : languageCode;
};

// Inlined from @formbricks/types/storage.ts to avoid Zod dependency
const mimeTypes: Record<string, string> = {
  heic: "image/heic",
  png: "image/png",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  webp: "image/webp",
  ico: "image/x-icon",
  pdf: "application/pdf",
  eml: "message/rfc822",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  mp4: "video/mp4",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  webm: "video/webm",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  tar: "application/x-tar",
  mp3: "audio/mpeg",
};

export const getMimeType = (extension: TAllowedFileExtension): string => mimeTypes[extension];

/**
 * Returns true if the string contains any RTL character.
 * @param text The input string to test
 */
export function isRTL(text: string): boolean {
  const rtlCharRegex = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
  return rtlCharRegex.test(text);
}

/**
 * List of RTL language codes
 */
const RTL_LANGUAGES = ["ar", "ar-SA", "ar-EG", "ar-AE", "ar-MA", "he", "fa", "ur"];

/**
 * Returns true if the language code represents an RTL language.
 * @param languageCode The language code to test (e.g., "ar", "ar-SA", "he")
 */
export function isRTLLanguage(survey: TJsWorkspaceStateSurvey, languageCode: string): boolean {
  if (survey.languages.length === 0) {
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
  } else {
    const code = getSurveyLanguageTag(survey, languageCode);
    const baseCode = code?.split("-")[0].toLowerCase() ?? "en";
    return RTL_LANGUAGES.some((rtl) => rtl.toLowerCase().startsWith(baseCode));
  }
}

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
  survey: TJsWorkspaceStateSurvey,
  blockId: string
): string | undefined => {
  const block = survey.blocks.find((b) => b.id === blockId);
  return block?.elements[0]?.id;
};
