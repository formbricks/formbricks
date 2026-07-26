import { normalizeLanguageCode } from "@formbricks/i18n-utils";
import { type TUserLocale, ZUserLocale } from "@formbricks/types/user";

// The UI locales Formbricks ships translations for. When the workspace default is one of these, the
// template's built-in copy is authored in it; otherwise the copy stays in the creator's UI locale.
const UI_LOCALES = ZUserLocale.options as readonly string[];

export type TResolvedSurveyDefaultLanguage = {
  // Code stored as the new survey's default language (canonical BCP-47).
  surveyDefaultLanguageCode: string;
  // UI locale used to translate the template's built-in copy — always a supported UI locale.
  translationLocale: TUserLocale;
};

/**
 * Decide the default language for a survey created from a template.
 *
 * - No (or stale) workspace default → preserve the historical behavior: the creator's UI locale becomes
 *   both the survey's default language and the copy language.
 * - A configured workspace default that is also a translatable UI locale → author the copy in it, so
 *   built-in labels (nav buttons, placeholders) render in that language, and set it as the default.
 * - A configured workspace default that is NOT a UI locale → set it as the survey's default language but
 *   keep the copy in the creator's UI locale (authors translate the copy afterwards).
 */
export function resolveSurveyDefaultLanguage(params: {
  requestLocale: TUserLocale;
  workspaceDefaultLanguageCode?: string | null;
  workspaceLanguageCodes: string[];
}): TResolvedSurveyDefaultLanguage {
  const { requestLocale, workspaceDefaultLanguageCode, workspaceLanguageCodes } = params;

  const normalizedDefault = workspaceDefaultLanguageCode
    ? normalizeLanguageCode(workspaceDefaultLanguageCode)
    : null;

  const isConfigured =
    normalizedDefault !== null &&
    workspaceLanguageCodes.some((code) => (normalizeLanguageCode(code) ?? code) === normalizedDefault);

  if (!normalizedDefault || !isConfigured) {
    return { surveyDefaultLanguageCode: requestLocale, translationLocale: requestLocale };
  }

  const translationLocale = UI_LOCALES.includes(normalizedDefault)
    ? (normalizedDefault as TUserLocale)
    : requestLocale;

  return { surveyDefaultLanguageCode: normalizedDefault, translationLocale };
}
