import { z } from "zod";
import {
  DEFAULT_SURVEY_LANGUAGE_CODE,
  SURVEY_RUNTIME_LANGUAGE_CODES,
  resolveSurveyRuntimeLanguageCode,
} from "@formbricks/i18n-utils/src/survey-runtime-languages";
import { type TUserLocale, ZUserLocale } from "@formbricks/types/user";
import type { TWorkspaceConfig } from "@formbricks/types/workspace";

type TResolveDefaultSurveyLanguageInput = {
  /** `workspace.config.defaultSurveyLanguage` — the workspace-level setting, if one is set. */
  workspaceDefaultLanguage?: TWorkspaceConfig["defaultSurveyLanguage"];
  /** `user.locale` of whoever is creating the survey. */
  userLocale?: string | null;
};

/**
 * The language a new survey should be authored in.
 *
 * Workspace setting → creator's app language → English. The workspace wins because the default language
 * is about the *respondents*, not the author: a German-only team should not get an English survey
 * because one colleague uses the dashboard in English (ENG-2816).
 *
 * Every branch is validated rather than trusted. The setting is stored in a JSON column and the picker
 * that writes it can be widened later, so a value the survey runtime ships no strings for is treated as
 * unset instead of being passed on — that is exactly the "Italian buttons, English validation errors"
 * failure this setting exists to prevent (ENG-2325).
 */
export const resolveDefaultSurveyLanguage = ({
  workspaceDefaultLanguage,
  userLocale,
}: TResolveDefaultSurveyLanguageInput): string =>
  resolveSurveyRuntimeLanguageCode(workspaceDefaultLanguage) ??
  ZUserLocale.safeParse(userLocale).data ??
  DEFAULT_SURVEY_LANGUAGE_CODE;

/**
 * The dashboard locale to generate a template's *body text* in for a given survey default language.
 *
 * Template questions come from `apps/web/locales`, which covers fewer languages than the survey runtime
 * bundles: a survey defaulting to a runtime-only language (`it-IT`) gets translated buttons and English
 * questions, which the creator can then edit. Choosing the fallback here keeps that miss explicit rather
 * than leaving it to a failed dynamic `import()` inside `getTranslate`.
 */
export const resolveTemplateTextLocale = (defaultSurveyLanguage: string): TUserLocale =>
  ZUserLocale.safeParse(defaultSurveyLanguage).data ?? DEFAULT_SURVEY_LANGUAGE_CODE;

/**
 * Whether a workspace `Language` row is the one the workspace default survey language points at.
 *
 * Both sides are canonicalized before comparing, so a row stored under a legacy code still matches the
 * canonical setting (a `de` row is the `de-DE` default). Used to block removing that row: the setting
 * would otherwise keep naming a language the workspace no longer has (ENG-2816).
 */
export const isWorkspaceDefaultSurveyLanguage = (
  languageCode: string,
  workspaceDefaultLanguage: TWorkspaceConfig["defaultSurveyLanguage"]
): boolean => {
  const defaultLanguage = resolveSurveyRuntimeLanguageCode(workspaceDefaultLanguage);
  return defaultLanguage !== null && resolveSurveyRuntimeLanguageCode(languageCode) === defaultLanguage;
};

/**
 * Every language `resolveDefaultSurveyLanguage` can return: the survey runtime's languages plus the
 * dashboard's, because a creator's own locale is still a valid authoring language even where the runtime
 * ships no bundle for it (`pt-PT`, which falls back to the `pt-BR` bundle at render time).
 */
const SURVEY_DEFAULT_LANGUAGE_CODES = new Set<string>([
  ...SURVEY_RUNTIME_LANGUAGE_CODES,
  ...ZUserLocale.options,
]);

/** Write-side guard for a survey's default language on survey creation. */
export const ZSurveyDefaultLanguageCode = z
  .string()
  .refine((code) => SURVEY_DEFAULT_LANGUAGE_CODES.has(code), "Unsupported survey default language");
