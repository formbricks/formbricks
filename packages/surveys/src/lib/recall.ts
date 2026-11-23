import { type TResponseData, type TResponseVariables } from "@formbricks/types/responses";
import { type TSurveyElement } from "@formbricks/types/surveys/elements";
import { formatDateWithOrdinal, parseDateString } from "@/lib/date-time";
import { getLocalizedValue } from "@/lib/i18n";

// Extracts the ID of recall question from a string containing the "recall" pattern.
const extractId = (text: string): string | null => {
  const pattern = /#recall:([A-Za-z0-9_-]+)/;
  const match = text.match(pattern);
  return match?.[1] ?? null;
};

// Extracts the fallback value from a string containing the "fallback" pattern.
// An index scan, not `/fallback:([^#]*)#/`: that pattern is O(N^2) on a long run of `fallback:`
// with no `#` after it, because the engine rescans to the end from every occurrence. Identical
// result — `[^#]*` cannot cross a `#`, so the regex ends at the first `#` after the FIRST
// `fallback:`, and if none follows that one none follows a later one either.
const FALLBACK_MARKER = "fallback:";

const extractFallbackValue = (text: string): string => {
  const markerStart = text.indexOf(FALLBACK_MARKER);
  if (markerStart === -1) return "";

  const valueStart = markerStart + FALLBACK_MARKER.length;
  const valueEnd = text.indexOf("#", valueStart);
  return valueEnd === -1 ? "" : text.slice(valueStart, valueEnd);
};

// Extracts the complete recall information (ID and fallback) from a headline string.
const extractRecallInfo = (headline: string, id?: string): string | null => {
  const idPattern = id ?? "[A-Za-z0-9_-]+";
  const pattern = new RegExp(String.raw`#recall:(${idPattern})\/fallback:([^#]*)#`);
  const match = headline.match(pattern);
  return match ? match[0] : null;
};

const formatRecallValue = (
  value: TResponseData[string] | null,
  languageCode: string,
  dayFirstLocale: string
): string => {
  if (value == null) return "";
  // Record answers keep the same display text as the original recall conversion.
  if (typeof value === "object" && !Array.isArray(value)) return Object.prototype.toString.call(value);

  const text = Array.isArray(value) ? value.join(",") : String(value);
  const parsed = parseDateString(text);
  if (parsed) return formatDateWithOrdinal(parsed.date, parsed.dayFirst ? dayFirstLocale : languageCode);

  return Array.isArray(value) ? value.filter(Boolean).join(", ") : text;
};

export const replaceRecallInfo = (
  text: string,
  responseData: TResponseData,
  variables: TResponseVariables,
  languageCode: string = "en-US",
  dayFirstLocale: string = languageCode
): string => {
  let modifiedText = text;

  while (modifiedText.includes("recall:")) {
    const recallInfo = extractRecallInfo(modifiedText);
    if (!recallInfo) break; // Exit the loop if no recall info is found

    const recallItemId = extractId(recallInfo);
    if (!recallItemId) return modifiedText; // Return the text if no ID could be extracted

    const fallback = extractFallbackValue(recallInfo).replace(/nbsp/g, " ").trim();
    let value: TResponseData[string] | null = null;

    // Fetching value from variables based on recallItemId
    if (variables[recallItemId] !== undefined) {
      value = String(variables[recallItemId]);
    }

    // Fetching value from responseData or attributes based on recallItemId
    if (responseData[recallItemId] !== undefined) {
      value = responseData[recallItemId] ?? fallback;
    }

    const formattedValue = formatRecallValue(value, languageCode, dayFirstLocale);

    // Replace the recallInfo in the text with the obtained or fallback value
    modifiedText = modifiedText.replace(recallInfo, formattedValue || fallback);
  }

  return modifiedText;
};

export const parseRecallInformation = (
  question: TSurveyElement,
  languageCode: string,
  responseData: TResponseData,
  variables: TResponseVariables,
  dayFirstLocale?: string
): TSurveyElement => {
  const modifiedQuestion = JSON.parse(JSON.stringify(question));
  // Use getLocalizedValue (falls back to the `default` key) instead of indexing by languageCode
  // directly — a code that isn't a content key (e.g. a legacy SDK language) would otherwise throw.
  if (getLocalizedValue(question.headline, languageCode).includes("recall:")) {
    modifiedQuestion.headline[languageCode] = replaceRecallInfo(
      getLocalizedValue(modifiedQuestion.headline, languageCode),
      responseData,
      variables,
      languageCode,
      dayFirstLocale
    );
  }
  if (
    question.subheader &&
    getLocalizedValue(question.subheader, languageCode).includes("recall:") &&
    modifiedQuestion.subheader
  ) {
    modifiedQuestion.subheader[languageCode] = replaceRecallInfo(
      getLocalizedValue(modifiedQuestion.subheader, languageCode),
      responseData,
      variables,
      languageCode,
      dayFirstLocale
    );
  }
  return modifiedQuestion;
};
