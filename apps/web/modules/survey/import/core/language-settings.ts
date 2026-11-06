import type { TSurveyImportDraft } from "./draft";

/**
 * The respondent language settings for a draft with `languageCount` enabled languages: the switch and
 * browser-language selection on with more than one, nothing with one.
 */
export const languageSettingsFor = (
  languageCount: number
): Pick<TSurveyImportDraft, "showLanguageSwitch" | "autoSelectLanguage"> =>
  languageCount > 1 ? { showLanguageSwitch: true, autoSelectLanguage: true } : {};

/**
 * The document with the language settings its enabled languages call for, after a fit dropped some: a
 * draft cut down to one enabled language loses them.
 */
export function withLanguageSettings(document: TSurveyImportDraft): void {
  delete document.showLanguageSwitch;
  delete document.autoSelectLanguage;
  Object.assign(
    document,
    languageSettingsFor(document.languages.filter((language) => language.enabled).length)
  );
}
