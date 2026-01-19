import { headers } from "next/headers";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { AVAILABLE_LOCALES, DEFAULT_LOCALE } from "@/lib/constants";

export const findMatchingLocale = async (): Promise<TUserLocale> => {
  const headersList = await headers();
  const acceptLanguage = headersList.get("accept-language");
  const userLocales = acceptLanguage?.split(",");
  if (!userLocales) {
    return DEFAULT_LOCALE;
  }
  // First, try to find an exact match without normalization
  for (const userLocale of userLocales) {
    const exactMatch = AVAILABLE_LOCALES.find((locale) => locale === userLocale);
    if (exactMatch) return exactMatch;
  }
  // If no exact match is found, try matching with normalization
  const normalizedAvailableLocales = AVAILABLE_LOCALES.map((locale) => locale.toLowerCase().split("-")[0]);

  for (const userLocale of userLocales) {
    const normalizedUserLocale = userLocale.toLowerCase().split("-")[0];
    const matchedIndex = normalizedAvailableLocales.findIndex((locale) =>
      locale.startsWith(normalizedUserLocale)
    );
    if (matchedIndex !== -1) return AVAILABLE_LOCALES[matchedIndex];
  }

  return DEFAULT_LOCALE;
};

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
