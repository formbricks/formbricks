import { type TI18nString } from "@formbricks/types/i18n";
import { TResponseData, TResponseDataValue, TResponseVariables } from "@formbricks/types/responses";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveyRecallItem } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { type TSurveyDateFormatMap, formatStoredDateForDisplay } from "./date-display";

export interface fallbacks {
  [id: string]: string;
}

// Extracts the ID of recall question from a string containing the "recall" pattern.
export const extractId = (text: string): string | null => {
  const pattern = /#recall:([A-Za-z0-9_-]+)/;
  const match = text.match(pattern);
  if (match && match[1]) {
    return match[1];
  } else {
    return null;
  }
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// If there are multiple recall infos in a string extracts all recall question IDs from that string and construct an array out of it.
export const extractIds = (text: string): string[] => {
  const pattern = /#recall:([A-Za-z0-9_-]+)/g;
  const matches = Array.from(text.matchAll(pattern));
  return matches.map((match) => match[1]).filter((id) => id !== null);
};

// Extracts the fallback value from a string containing the "fallback" pattern.
// An index scan, not `/fallback:([^#]*)#/`: that pattern is O(N^2) on a long run of `fallback:`
// with no `#` after it, because the engine rescans to the end from every occurrence. Identical
// result — `[^#]*` cannot cross a `#`, so the regex ends at the first `#` after the FIRST
// `fallback:`, and if none follows that one none follows a later one either.
const FALLBACK_MARKER = "fallback:";

export const extractFallbackValue = (text: string): string => {
  const markerStart = text.indexOf(FALLBACK_MARKER);
  if (markerStart === -1) return "";

  const valueStart = markerStart + FALLBACK_MARKER.length;
  const valueEnd = text.indexOf("#", valueStart);
  return valueEnd === -1 ? "" : text.slice(valueStart, valueEnd);
};

// Extracts the complete recall information (ID and fallback) from a headline string.
export const extractRecallInfo = (headline: string, id?: string): string | null => {
  const idPattern = id ? escapeRegExp(id) : "[A-Za-z0-9_-]+";
  const pattern = new RegExp(`#recall:(${idPattern})\\/fallback:([^#]*)#`);
  const match = headline.match(pattern);
  return match ? match[0] : null;
};

// Finds the recall information by a specific recall question ID within a text.
export const findRecallInfoById = (text: string, id: string): string | null => {
  const pattern = new RegExp(`#recall:${escapeRegExp(id)}\\/fallback:([^#]*)#`, "g");
  const match = text.match(pattern);
  return match ? match[0] : null;
};

export const getRecallItemLabel = <T extends TSurvey>(
  recallItemId: string,
  survey: T,
  languageCode: string
): string | undefined => {
  const isHiddenField = survey.hiddenFields.fieldIds?.includes(recallItemId);
  if (isHiddenField) return recallItemId;

  const questions = getElementsFromBlocks(survey.blocks);
  const surveyQuestion = questions.find((question) => question.id === recallItemId);
  if (surveyQuestion) {
    const headline = getLocalizedValue(surveyQuestion.headline, languageCode);
    // Strip HTML tags to prevent raw HTML from showing in nested recalls
    return headline ? getTextContent(headline) : headline;
  }

  const variable = survey.variables?.find((variable) => variable.id === recallItemId);
  if (variable) return variable.name;
};

// Converts recall information in a headline to a corresponding recall question headline, with or without a slash.
export const recallToHeadline = <T extends TSurvey>(
  headline: TI18nString,
  survey: T,
  withSlash: boolean,
  languageCode: string
): TI18nString => {
  let newHeadline = structuredClone(headline);
  const localizedHeadline = newHeadline[languageCode];

  if (!localizedHeadline?.includes("#recall:")) return headline;

  const replaceNestedRecalls = (text: string): string => {
    while (text.includes("#recall:")) {
      const recallInfo = extractRecallInfo(text);
      if (!recallInfo) break;

      const recallItemId = extractId(recallInfo);
      if (!recallItemId) break;

      let recallItemLabel = getRecallItemLabel(recallItemId, survey, languageCode) || recallItemId;

      while (recallItemLabel.includes("#recall:")) {
        const nestedRecallInfo = extractRecallInfo(recallItemLabel);
        if (nestedRecallInfo) {
          recallItemLabel = recallItemLabel.replace(nestedRecallInfo, "___");
        }
      }

      const replacement = withSlash ? `/${recallItemLabel}\\` : `@${recallItemLabel}`;
      text = text.replace(recallInfo, replacement);
    }
    return text;
  };

  newHeadline[languageCode] = replaceNestedRecalls(localizedHeadline);
  return newHeadline;
};

// Replaces recall information in a survey question's headline with an ___.
export const replaceRecallInfoWithUnderline = (label: string): string => {
  let newLabel = label;
  while (newLabel.includes("#recall:")) {
    const recallInfo = extractRecallInfo(newLabel);
    if (recallInfo) {
      newLabel = newLabel.replace(recallInfo, "___");
    }
  }
  return newLabel;
};

// Checks for survey questions with a "recall" pattern but no fallback value.
export const checkForEmptyFallBackValue = (survey: TSurvey, language: string): TSurveyElement | null => {
  const doesTextHaveRecall = (text: string) => {
    const recalls = text.match(/#recall:[^ ]+/g);
    return recalls?.some((recall) => !extractFallbackValue(recall));
  };

  const questions = getElementsFromBlocks(survey.blocks);
  for (const question of questions) {
    if (
      doesTextHaveRecall(getLocalizedValue(question.headline, language)) ||
      (question.subheader && doesTextHaveRecall(getLocalizedValue(question.subheader, language)))
    ) {
      return question;
    }
  }
  return null;
};

// Processes each question in a survey to ensure headlines are formatted correctly for recall and return the modified survey.
export const replaceHeadlineRecall = <T extends TSurvey>(survey: T, language: string): T => {
  const modifiedSurvey = structuredClone(survey);
  const questions = getElementsFromBlocks(modifiedSurvey.blocks);
  questions.forEach((question) => {
    question.headline = recallToHeadline(question.headline, modifiedSurvey, false, language);
  });
  return modifiedSurvey;
};

// Retrieves an array of survey questions referenced in a text containing recall information.
export const getRecallItems = (text: string, survey: TSurvey, languageCode: string): TSurveyRecallItem[] => {
  if (!text.includes("#recall:")) return [];

  const ids = extractIds(text);
  let recallItems: TSurveyRecallItem[] = [];
  ids.forEach((recallItemId) => {
    const isHiddenField = survey.hiddenFields.fieldIds?.includes(recallItemId);
    const questions = getElementsFromBlocks(survey.blocks);
    const isSurveyQuestion = questions.find((question) => question.id === recallItemId);
    const isVariable = survey.variables.find((variable) => variable.id === recallItemId);

    const recallItemLabel = getRecallItemLabel(recallItemId, survey, languageCode);

    const getRecallItemType = () => {
      if (isHiddenField) return "hiddenField";
      if (isSurveyQuestion) return "element";
      if (isVariable) return "variable";
    };

    if (recallItemLabel) {
      let recallItemLabelTemp = recallItemLabel;
      recallItemLabelTemp = replaceRecallInfoWithUnderline(recallItemLabelTemp);
      const recallItemType = getRecallItemType();
      if (recallItemType) {
        recallItems.push({
          id: recallItemId,
          label: recallItemLabelTemp,
          type: recallItemType,
        });
      }
    }
  });
  return recallItems;
};

// Constructs a fallbacks object from a text containing multiple recall and fallback patterns.
export const getFallbackValues = (text: string): fallbacks => {
  if (!text.includes("#recall:")) return {};
  const pattern = /#recall:([A-Za-z0-9_-]+)\/fallback:([^#]*)#/g;
  let match;
  const fallbacks: fallbacks = {};

  while ((match = pattern.exec(text)) !== null) {
    const id = match[1];
    const fallbackValue = match[2];
    fallbacks[id] = fallbackValue;
  }
  return fallbacks;
};

// Transforms headlines in a text to their corresponding recall information.
export const headlineToRecall = (
  text: string | undefined,
  recallItems: TSurveyRecallItem[],
  fallbacks: fallbacks
): string => {
  if (!text) return "";

  recallItems.forEach((recallItem) => {
    const recallInfo = `#recall:${recallItem.id}/fallback:${fallbacks[recallItem.id]}#`;
    text = text?.replace(`@${recallItem.label}`, recallInfo);
  });
  return text;
};

/** The trailing `\#` a slash-wrapped recall tag ends with. */
const RECALL_SLASH_SUFFIX = String.raw`\#`;

/**
 * A response value is `string | number | string[] | Record<string, string>`. Arrays and dates are
 * already normalized above, but matrix and address answers arrive as records, which would coerce to
 * `[object Object]` if handed to `String()`.
 */
const stringifyRecallValue = (value: TResponseDataValue): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (value) return Object.values(value).filter(Boolean).join(", ");
  return "";
};

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Encodes a string so it renders as literal text in HTML, in element content or a quoted attribute.
 *
 * Encoding, not sanitizing: `sanitize-html` and DOMPurify parse markup and *remove* what isn't allowed,
 * which is the wrong tool here — a respondent who answers `<b>bold</b>` should see that text in the
 * email, not have it silently dropped. Escaping is also what makes the value inert regardless of where
 * the surrounding template puts it.
 *
 * Single pass over the five characters rather than chained `replaceAll`s, so `&` cannot be
 * double-encoded if someone reorders the entries — with sequential replacements, moving the `&` rule
 * after the others turns `<` into `&amp;lt;`.
 */
const escapeHtml = (value: string): string => value.replaceAll(/[&<>"']/g, (char) => HTML_ENTITIES[char]);

/**
 * @param escapeValues HTML-escape each substituted value before splicing it in. Off by default because
 * most callers render the result through React, which escapes for them — escaping here too would show
 * literal `&amp;`. Turn it on when the result goes into raw HTML, e.g. the follow-up email body.
 *
 * The recalled value is a respondent's answer, i.e. data, and must never become markup. Sanitizing the
 * *combined* string afterwards is not a substitute: a sanitizer cannot tell the survey author's
 * intended markup from markup a respondent injected, so an allowlist that legitimately permits
 * `<a href>` in an author-written body will equally pass off an anchor spliced in from an answer.
 */
export const parseRecallInfo = (
  text: string,
  responseData?: TResponseData,
  variables?: TResponseVariables,
  withSlash: boolean = false,
  locale: string = "en-US",
  dateFormats?: TSurveyDateFormatMap,
  escapeValues: boolean = false
) => {
  let modifiedText = text;
  const questionIds = responseData ? Object.keys(responseData) : [];
  const variableIds = variables ? Object.keys(variables) : [];

  // Process all recall patterns regardless of whether we have matching data
  while (modifiedText.includes("#recall:")) {
    const recallInfo = extractRecallInfo(modifiedText);
    if (!recallInfo) break; // Exit the loop if no recall info is found

    const recallItemId = extractId(recallInfo);
    if (!recallItemId) {
      // If no ID could be extracted, just remove the recall tag
      modifiedText = modifiedText.replace(recallInfo, "");
      continue;
    }

    const fallback = extractFallbackValue(recallInfo).replaceAll("nbsp", " ");
    let value: TResponseDataValue | undefined;

    // First check if it matches a variable
    if (variables && variableIds.includes(recallItemId)) {
      value = variables[recallItemId];
    }
    // Then check if it matches response data
    else if (responseData && questionIds.includes(recallItemId)) {
      value = responseData[recallItemId];

      // Apply formatting for special value types
      if (typeof value === "string") {
        const formattedDate = formatStoredDateForDisplay(value, dateFormats?.[recallItemId], locale);

        if (formattedDate) {
          value = formattedDate;
        }
      } else if (Array.isArray(value)) {
        value = value.filter((item) => item).join(", ");
      }
    }

    // If no value was found, use the fallback
    if (value === undefined || value === null || value === "") {
      value = fallback;
    }

    // Stringify unconditionally, escape only when asked. Gating the stringify on `escapeValues` left the
    // default path casting a `Record<string, string>` answer (matrix, address) straight to string, which
    // renders as "[object Object]" — the exact bug stringifyRecallValue exists to prevent, still live for
    // every caller outside the follow-up-email flow. Raised by CodeRabbit on #8681.
    const stringifiedValue = stringifyRecallValue(value);
    const substitutedValue = escapeValues ? escapeHtml(stringifiedValue) : stringifiedValue;
    // Replacer functions, not replacement strings: `$&`, `` $` `` and friends are special in a
    // replacement string, so an answer containing them would splice part of the pattern back in.
    if (withSlash) {
      modifiedText = modifiedText.replace(recallInfo, () => `#/${substitutedValue}${RECALL_SLASH_SUFFIX}`);
    } else {
      modifiedText = modifiedText.replace(recallInfo, () => substitutedValue);
    }
  }

  return modifiedText;
};

export const getTextContentWithRecallTruncated = (text: string, maxLength: number = 25): string => {
  const cleanText = getTextContent(text).replaceAll(/\s+/g, " ").trim();

  if (cleanText.length <= maxLength) {
    return replaceRecallInfoWithUnderline(cleanText);
  }

  const recalledCleanText = replaceRecallInfoWithUnderline(cleanText);

  const start = recalledCleanText.slice(0, 10);
  const end = recalledCleanText.slice(-10);

  return `${start}...${end}`;
};
