import { TSurvey } from "@formbricks/types/surveys/types";

/**
 * Maps survey language codes to web app locale codes.
 * Falls back to "en-US" if the language is not available in web app locales.
 */
export const getWebAppLocale = (languageCode: string, survey: TSurvey): string => {
  // Map of common 2-letter language codes to web app locale codes
  const languageToLocaleMap: Record<string, string> = {
    en: "en-US",
    de: "de-DE",
    pt: "pt-BR", // Default to Brazilian Portuguese
    "pt-BR": "pt-BR",
    "pt-PT": "pt-PT",
    fr: "fr-FR",
    nl: "nl-NL",
    zh: "zh-Hans-CN", // Default to Simplified Chinese
    "zh-Hans": "zh-Hans-CN",
    "zh-Hans-CN": "zh-Hans-CN",
    "zh-Hant": "zh-Hant-TW",
    "zh-Hant-TW": "zh-Hant-TW",
    ro: "ro-RO",
    ja: "ja-JP",
    es: "es-ES",
    sv: "sv-SE",
    ru: "ru-RU",
  };

  let codeToMap = languageCode;

  // If languageCode is "default", get the default language from survey
  if (languageCode === "default") {
    const defaultLanguage = survey.languages?.find((lang) => lang.default);
    if (defaultLanguage) {
      codeToMap = defaultLanguage.language.code;
    } else {
      return "en-US";
    }
  }

  // Check if it's already a web app locale code
  if (languageToLocaleMap[codeToMap]) {
    return languageToLocaleMap[codeToMap];
  }

  // Try to find a match by base language code (e.g., "pt-BR" -> "pt")
  const baseCode = codeToMap.split("-")[0].toLowerCase();
  if (languageToLocaleMap[baseCode]) {
    return languageToLocaleMap[baseCode];
  }

  // Fallback to English if language is not supported
  return "en-US";
};
