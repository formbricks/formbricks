import { z } from "zod";
import { normalizeLanguageCode } from "@formbricks/i18n-utils/src/canonical";
import {
  DEFAULT_SURVEY_LANGUAGE_CODE,
  isSurveyRuntimeLanguage,
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
 * The canonical form of a survey language code, or `null` when it is not a language tag at all.
 *
 * Canonical, not the bundle it renders from: `es-MX` stays `es-MX` (served by the `es-ES` strings) so a
 * survey is authored in the language the workspace actually configured, and a legacy `de` becomes
 * `de-DE` so one setting matches both spellings of a `Language.code` row (ENG-1067).
 */
const canonicalSurveyLanguageCode = (code: string | null | undefined): string | null =>
  code ? normalizeLanguageCode(code.trim()) : null;

/**
 * The language a new survey should be authored in.
 *
 * Workspace setting → creator's app language → English. The workspace wins because the default language
 * is about the *respondents*, not the author: a German-only team should not get an English survey
 * because one colleague uses the dashboard in English (ENG-2816).
 *
 * Every branch is validated rather than trusted. The setting is stored in a JSON column, so a value the
 * survey runtime has no strings for is treated as unset instead of being passed on — that is the
 * "translated questions, English buttons" failure this setting exists to prevent (ENG-2325).
 */
export const resolveDefaultSurveyLanguage = ({
  workspaceDefaultLanguage,
  userLocale,
}: TResolveDefaultSurveyLanguageInput): string => {
  const workspaceDefault = canonicalSurveyLanguageCode(workspaceDefaultLanguage);

  if (workspaceDefault && isSurveyRuntimeLanguage(workspaceDefault)) {
    return workspaceDefault;
  }

  return ZUserLocale.safeParse(userLocale).data ?? DEFAULT_SURVEY_LANGUAGE_CODE;
};

/**
 * The dashboard locale to generate a template's *body text* in for a given survey default language.
 *
 * Template questions come from `apps/web/locales`, which covers fewer languages than the survey runtime:
 * a survey defaulting to a language the dashboard is not translated into (`it-IT`, `es-MX`) gets
 * translated buttons and English questions, which the creator can then edit. Choosing the fallback here
 * keeps that miss explicit rather than leaving it to a failed dynamic `import()` inside `getTranslate`.
 */
export const resolveTemplateTextLocale = (defaultSurveyLanguage: string): TUserLocale =>
  ZUserLocale.safeParse(defaultSurveyLanguage).data ?? DEFAULT_SURVEY_LANGUAGE_CODE;

/**
 * Whether a workspace `Language` row is the one the workspace default survey language points at.
 *
 * Compared on canonical codes, not on the bundle each renders from: a `de` row is the `de-DE` default,
 * but `es-MX` and `es-ES` are two different languages even though both render the `es-ES` strings. Used
 * to block removing that row, so the setting cannot keep naming a language the workspace no longer has.
 */
export const isWorkspaceDefaultSurveyLanguage = (
  languageCode: string,
  workspaceDefaultLanguage: TWorkspaceConfig["defaultSurveyLanguage"]
): boolean => {
  const defaultLanguage = canonicalSurveyLanguageCode(workspaceDefaultLanguage);
  return defaultLanguage !== null && canonicalSurveyLanguageCode(languageCode) === defaultLanguage;
};

/**
 * Write-side guard for a survey's default language on survey creation: any language the runtime has
 * strings for, plus the dashboard's own locales, since a creator's locale is always a valid fallback.
 */
export const ZSurveyDefaultLanguageCode = z
  .string()
  .refine(
    (code) => isSurveyRuntimeLanguage(code) || ZUserLocale.options.includes(code as TUserLocale),
    "Unsupported survey default language"
  );
