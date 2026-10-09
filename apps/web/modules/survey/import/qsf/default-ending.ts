import { matchSurveyLanguage } from "@formbricks/i18n-utils/survey-language-match";
import { type TUserLocale, ZUserLocale } from "@formbricks/types/user";

export type TDefaultEndingText = { headline: string; subheader: string };

const APP_LOCALES = ZUserLocale.options.map((code) => ({
  default: false,
  enabled: true,
  language: { code },
}));

/** The app language a survey language reads its strings from, matched like a respondent's language. */
const matchAppLocale = (code: string): TUserLocale | null => {
  const matched = matchSurveyLanguage(APP_LOCALES, code);
  return ZUserLocale.options.find((locale) => locale === matched) ?? null;
};

const loadDefaultEndingText = async (locale: TUserLocale): Promise<TDefaultEndingText> => {
  const { default: messages } = (await import(`../../../../locales/${locale}.json`)) as {
    default: { templates: Record<string, string> };
  };
  return {
    headline: messages.templates.default_ending_card_headline,
    subheader: messages.templates.default_ending_card_subheader,
  };
};

/**
 * The editor's default ending in each of the survey's languages, from Formbricks' own translations
 * (`de-AT` reads the `de-DE` strings). A language Formbricks has no strings for gets `null`, except the
 * default language: it has to show text, so it gets English.
 */
export const getDefaultEndingTexts = (
  languageCodes: readonly string[]
): Promise<(TDefaultEndingText | null)[]> =>
  Promise.all(
    languageCodes.map(async (code, index) => {
      const locale = matchAppLocale(code) ?? (index === 0 ? "en-US" : null);
      return locale ? loadDefaultEndingText(locale) : null;
    })
  );
