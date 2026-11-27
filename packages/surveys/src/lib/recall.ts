import { type TResponseData, type TResponseVariables } from "@formbricks/types/responses";
import { type TSurveyElement } from "@formbricks/types/surveys/elements";
import { formatDateWithOrdinal, parseDateString } from "@/lib/date-time";
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
 * The entities an author's fallback picks up when the editor serializes the rich-text template to HTML
 * (`R&D` is stored as `R&amp;D`). Named entities beyond these, and numeric ones, are decoded too; anything
 * unrecognised is left as typed.
 */
const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

const decodeStoredEntities = (value: string): string =>
  value.replaceAll(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body.startsWith("#")) {
      const hex = body[1] === "x" || body[1] === "X";
      const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });

/**
 * `"rich"` (default): the result is rendered as a headline or subheader, which treats it as HTML when it
 * parses as HTML. `"text"`: the result is used as plain text or a URL (redirect link, button label) and
 * values are substituted as they are; HTML-escaping there would show entities literally.
 */
export type TRecallOutput = "rich" | "text";

/** A recall token: `#recall:<id>/fallback:<text>#`. */
const RECALL_TOKEN = /#recall:([A-Za-z0-9_-]+)\/fallback:([^#]*)#/g;

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

const resolveRecallValue = (
  recallItemId: string,
  rawFallback: string,
  responseData: TResponseData,
  variables: TResponseVariables,
  languageCode: string,
  dayFirstLocale: string
): { value: string; usedFallback: boolean } => {
  const fallback = rawFallback.replaceAll("nbsp", " ").trim();
  let value: TResponseData[string] | null = null;

  // Fetching value from variables based on recallItemId
  if (variables[recallItemId] !== undefined) {
    value = String(variables[recallItemId]);
  }

  // Fetching value from responseData or attributes based on recallItemId
  if (responseData[recallItemId] !== undefined) {
    value = responseData[recallItemId] ?? fallback;
  }

  const resolved = formatRecallValue(value, languageCode, dayFirstLocale);
  return resolved ? { value: resolved, usedFallback: false } : { value: fallback, usedFallback: true };
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
  output: TRecallOutput = "rich",
  dayFirstLocale: string = languageCode
): string => {
  if (!text.includes("recall:")) return text;

  const escapeValues = output === "rich" && isValidHTML(text);
  // A replacer function: a string replacement would interpret `$&` and `$1` in the value.
  const modifiedText = text.replace(RECALL_TOKEN, (_token, id: string, rawFallback: string) => {
    const resolved = resolveRecallValue(
      id,
      rawFallback,
      responseData,
      variables,
      languageCode,
      dayFirstLocale
    );
    if (!escapeValues) return resolved.value;
    // The fallback is authored text stored inside the template's HTML, so it arrives HTML-escaped: decode
    // it once before the one escape, or `R&D` written in the editor renders as `R&amp;D`. A recalled
    // value was never escaped, so it keeps its single escape.
    return escapeHtml(resolved.usedFallback ? decodeStoredEntities(resolved.value) : resolved.value);
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
      "rich",
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
      "rich",
      dayFirstLocale
    );
  }
  return modifiedQuestion;
};
