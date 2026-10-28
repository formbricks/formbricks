import type { I18nString, SurveyLanguage } from "./types";

const isI18nString = (value: unknown): value is I18nString =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((entry) => typeof entry === "string");

const findKey = (value: I18nString, code: string): string | undefined => {
  if (code in value) return code;
  const lower = code.toLowerCase();
  return Object.keys(value).find((key) => key.toLowerCase() === lower);
};

/**
 * One translatable string in the language the person is looking at, falling back to the survey's default
 * language and then to any text there is, so a half-translated survey still reads as a survey. Rich-text
 * markup is flattened to plain text: the review tab never renders survey content as HTML.
 */
export const resolveText = (value: unknown, languageCode: string, defaultLanguage: string): string => {
  if (typeof value === "string") return toPlainText(value);
  if (!isI18nString(value)) return "";
  const key = findKey(value, languageCode) ?? findKey(value, defaultLanguage) ?? findKey(value, "default");
  const raw = key !== undefined ? value[key] : Object.values(value)[0];
  return toPlainText(raw ?? "");
};

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

/** Tags out, common entities decoded, whitespace collapsed. Output is only ever rendered as text. */
export const toPlainText = (raw: string): string =>
  raw
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, " ")
    .trim();

/** Whether a translation exists for this language (used to flag missing translations in the outline). */
export const hasTranslation = (value: unknown, languageCode: string): boolean =>
  isI18nString(value) && findKey(value, languageCode) !== undefined && value[findKey(value, languageCode) ?? ""] !== "";

export const getEnabledLanguages = (languages: SurveyLanguage[]): SurveyLanguage[] =>
  languages.filter((language) => language.enabled);
