import { type TResponseData, type TResponseVariables } from "@formbricks/types/responses";
import { type TSurveyElement } from "@formbricks/types/surveys/elements";
import { formatDateWithOrdinal, isValidDateString } from "@/lib/date-time";
import { isValidHTML } from "@/lib/html-utils";
import { getLocalizedValue } from "@/lib/i18n";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const escapeHtml = (value: string): string => value.replaceAll(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

/**
 * `"rich"` (default): the result is rendered as a headline or subheader, which treats it as HTML when it
 * parses as HTML. `"text"`: the result is used as plain text or a URL (redirect link, button label) and
 * values are substituted as they are; HTML-escaping there would show entities literally.
 */
export type TRecallOutput = "rich" | "text";

/**
 * Recalled values come from respondents and from the URL (hidden fields), so they must never become
 * markup. In a rich-text template, which is decided on the template BEFORE substitution, values are
 * HTML-escaped. A plain-text template stays plain so entities are not shown literally; if a value would
 * nevertheless make the result parse as HTML, the escaped result is wrapped in a paragraph so it
 * renders as the text that was typed, through the sanitiser, instead of as attacker markup.
 */
const RECALL_TOKEN = /#recall:([A-Za-z0-9_-]+)\/fallback:([^#]*)#/g;

const resolveRecallValue = (
  recallItemId: string,
  rawFallback: string,
  responseData: TResponseData,
  variables: TResponseVariables,
  languageCode: string
): string => {
  const fallback = rawFallback.replaceAll("nbsp", " ").trim();
  let value: string | null = null;

  // Fetching value from variables based on recallItemId
  if (variables[recallItemId] !== undefined) {
    value = String(variables[recallItemId]);
  }

  // Fetching value from responseData or attributes based on recallItemId
  if (responseData[recallItemId] !== undefined) {
    value = (responseData[recallItemId] as string) ?? fallback;
  }

  // Additional value formatting if it exists
  if (value) {
    if (isValidDateString(value)) {
      value = formatDateWithOrdinal(new Date(value), languageCode);
    } else if (Array.isArray(value)) {
      value = value.filter((item) => item).join(", "); // Filters out empty values and joins with a comma
    }
  }

  // eslint-disable-next-line typescript/prefer-nullish-coalescing -- an empty value shows the fallback too
  return value?.toString() || fallback;
};

/**
 * Recalled values come from respondents and from the URL (hidden fields), so they must never become
 * markup. In a rich-text template, which is decided on the template BEFORE substitution, values are
 * HTML-escaped. A plain-text template stays plain so entities are not shown literally; if a value would
 * nevertheless make the result parse as HTML, the escaped result is wrapped in a paragraph so it
 * renders as the text that was typed, through the sanitiser, instead of as attacker markup.
 * One pass over the template: a substituted value is never scanned for recall tokens again, so a value
 * that spells a token can neither loop forever nor pull in another field.
 */
export const replaceRecallInfo = (
  text: string,
  responseData: TResponseData,
  variables: TResponseVariables,
  languageCode: string = "en-US",
  output: TRecallOutput = "rich"
): string => {
  if (!text.includes("recall:")) return text;

  const escapeValues = output === "rich" && isValidHTML(text);
  // A replacer function: a string replacement would interpret `$&` and `$1` in the value.
  const modifiedText = text.replace(RECALL_TOKEN, (_token, id: string, rawFallback: string) => {
    const value = resolveRecallValue(id, rawFallback, responseData, variables, languageCode);
    return escapeValues ? escapeHtml(value) : value;
  });

  if (output === "rich" && !escapeValues && modifiedText !== text && isValidHTML(modifiedText)) {
    return `<p>${escapeHtml(modifiedText)}</p>`;
  }

  return modifiedText;
};

export const parseRecallInformation = (
  question: TSurveyElement,
  languageCode: string,
  responseData: TResponseData,
  variables: TResponseVariables
): TSurveyElement => {
  const modifiedQuestion = JSON.parse(JSON.stringify(question));
  // Use getLocalizedValue (falls back to the `default` key) instead of indexing by languageCode
  // directly — a code that isn't a content key (e.g. a legacy SDK language) would otherwise throw.
  if (getLocalizedValue(question.headline, languageCode).includes("recall:")) {
    modifiedQuestion.headline[languageCode] = replaceRecallInfo(
      getLocalizedValue(modifiedQuestion.headline, languageCode),
      responseData,
      variables,
      languageCode
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
      languageCode
    );
  }
  return modifiedQuestion;
};
