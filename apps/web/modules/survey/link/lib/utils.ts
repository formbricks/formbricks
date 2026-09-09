import { TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale, ZUserLocale } from "@formbricks/types/user";

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
 * Resolves the survey's active language to a BCP-47 tag for the <html lang> attribute.
 * A real code (e.g. "en-AU", "he") is returned as-is; "default" resolves to the survey's
 * default language code. Returns null when no language is configured, so the caller can
 * leave the existing lang untouched rather than guessing.
 */
export const getSurveyLanguageTag = (
  survey: TJsWorkspaceStateSurvey,
  languageCode: string
): string | null => {
  if (languageCode && languageCode !== "default") return languageCode;
  return survey.languages.find((language) => language.default)?.language.code ?? null;
};

/**
 * Survey language codes that do not name a web app locale outright. Bare language codes pick the
 * variant we ship ("pt" -> Brazilian Portuguese), and the Chinese script codes pick their region
 * because "zh-Hant" shares its base code with "zh-Hans".
 */
const SURVEY_LANGUAGE_ALIASES: Record<string, TUserLocale> = {
  en: "en-US",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
  hu: "hu-HU",
  ja: "ja-JP",
  nl: "nl-NL",
  pt: "pt-BR",
  ro: "ro-RO",
  ru: "ru-RU",
  sv: "sv-SE",
  tr: "tr-TR",
  zh: "zh-Hans-CN",
  "zh-hans": "zh-Hans-CN",
  "zh-hant": "zh-Hant-TW",
};

/**
 * Maps a survey language code to the web app locale its chrome should be translated in, or null when
 * the app ships no translation for it (a Hebrew survey, say) so the caller can keep its own fallback
 * rather than being forced to English.
 *
 * @param languageCode A survey language code, or "default" for the survey's default language
 */
export const resolveWebAppLocale = (languageCode: string, survey: TSurvey): TUserLocale | null => {
  let codeToMap = languageCode;

  if (languageCode === "default") {
    const defaultLanguage = survey.languages?.find((lang) => lang.default);
    if (!defaultLanguage) return null;
    codeToMap = defaultLanguage.language.code;
  }

  const codeToMapLower = codeToMap.toLowerCase();

  // An exact locale first, so a survey language that already names one ("pt-PT") keeps its variant
  // instead of collapsing into the base language's default ("pt" -> "pt-BR").
  const exactLocale = ZUserLocale.options.find((locale) => locale.toLowerCase() === codeToMapLower);
  if (exactLocale) return exactLocale;

  return (
    SURVEY_LANGUAGE_ALIASES[codeToMapLower] ?? SURVEY_LANGUAGE_ALIASES[codeToMapLower.split("-")[0]] ?? null
  );
};

/**
 * Maps survey language codes to web app locale codes.
 * Falls back to "en-US" if the language is not available in web app locales.
 */
export const getWebAppLocale = (languageCode: string, survey: TSurvey): string =>
  resolveWebAppLocale(languageCode, survey) ?? "en-US";

interface GateLocaleParams {
  /** The raw `?lang=` value, present only when the respondent asked for a language. */
  langParam: string | undefined;
  /** That value resolved against the survey's enabled languages, or "default". */
  languageCode: string;
  survey: TSurvey;
  /** The locale negotiated from the Accept-Language header. */
  fallbackLocale: TUserLocale;
}

/**
 * The locale the gate screens in front of a survey (PIN entry, email verification) translate their own
 * chrome in, and the one the verification email is written in.
 *
 * Precedence is deliberate and narrow: an explicit `?lang=` that resolves to a language we translate
 * the app into wins, because that is the language the survey content itself will render in. Everything
 * else — no `lang` at all, or one the app has no translation for — keeps the Accept-Language locale.
 */
export const getGateLocale = ({
  langParam,
  languageCode,
  survey,
  fallbackLocale,
}: GateLocaleParams): TUserLocale => {
  if (!langParam) return fallbackLocale;
  return resolveWebAppLocale(languageCode, survey) ?? fallbackLocale;
};
