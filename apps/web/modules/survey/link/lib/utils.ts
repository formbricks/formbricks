import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";

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
 * @param survey The survey to test
 * @param languageCode The language code to test (e.g., "ar", "ar-SA", "he")
 */
export function isRTLLanguage(survey: TJsEnvironmentStateSurvey, languageCode: string): boolean {
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
    const code =
      languageCode === "default"
        ? survey.languages.find((language) => language.default)?.language.code
        : languageCode;
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
