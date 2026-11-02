/**
 * The dashboard's language as the Creatives screens format dates, numbers and language names in: the app
 * language react-i18next resolved, never a browser default (AGENTS.md "Date and Time Rendering").
 */
export const getUiLocale = (i18n: Readonly<{ resolvedLanguage?: string; language?: string }>): string =>
  i18n.resolvedLanguage ?? i18n.language ?? "en-US";
