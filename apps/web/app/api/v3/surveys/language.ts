import type { TSurvey as TInternalSurvey } from "@formbricks/types/surveys/types";

type TV3SurveyLanguageInput = {
  code: string;
  enabled: boolean;
};

export type TV3SurveyLanguage = {
  code: string;
  default: boolean;
  enabled: boolean;
};

type TV3SurveyLanguageQueryInput = string | string[];

type TResolveV3SurveyLanguageCodeResult =
  | { ok: true; code: string }
  | { ok: false; reason: "invalid" | "unknown"; message: string; normalizedCode?: string };

type TParseV3SurveyLanguageQueryResult = { ok: true; languages: string[] } | { ok: false; message: string };

const V3_SURVEY_LOCALE_CODE_REGEX = /^[a-z]{2}(?:-[A-Z][a-z]{3})?-[A-Z]{2}$/;

export function normalizeV3SurveyLanguageTag(value: string): string | null {
  const normalizedSeparators = value.trim().replaceAll("_", "-");

  try {
    const normalizedLanguage = Intl.getCanonicalLocales(normalizedSeparators)[0] ?? null;
    if (!normalizedLanguage || !V3_SURVEY_LOCALE_CODE_REGEX.test(normalizedLanguage)) {
      return null;
    }

    return normalizedLanguage;
  } catch {
    return null;
  }
}

export function parseV3SurveyLanguageQuery(
  value: TV3SurveyLanguageQueryInput
): TParseV3SurveyLanguageQueryResult {
  const requestedLanguages = (Array.isArray(value) ? value : [value])
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim());

  if (requestedLanguages.some((entry) => entry.length === 0)) {
    return {
      ok: false,
      message: "Language selector must contain valid comma-separated locale codes",
    };
  }

  const normalizedLanguages: string[] = [];

  for (const language of requestedLanguages) {
    const normalizedLanguage = normalizeV3SurveyLanguageTag(language);

    if (!normalizedLanguage) {
      return {
        ok: false,
        message: `Language '${language}' is not a valid locale code`,
      };
    }

    if (!normalizedLanguages.some((entry) => entry.toLowerCase() === normalizedLanguage.toLowerCase())) {
      normalizedLanguages.push(normalizedLanguage);
    }
  }

  return { ok: true, languages: normalizedLanguages };
}

export function resolveV3SurveyLanguageCode(
  requestedLanguage: string,
  languages: TV3SurveyLanguageInput[]
): TResolveV3SurveyLanguageCodeResult {
  const normalizedRequestedLanguage = normalizeV3SurveyLanguageTag(requestedLanguage);

  if (!normalizedRequestedLanguage) {
    return {
      ok: false,
      reason: "invalid",
      message: `Language '${requestedLanguage}' is not a valid locale code`,
    };
  }

  const normalizedLanguages = languages.map((language) => ({
    ...language,
    code: normalizeV3SurveyLanguageTag(language.code) ?? language.code,
  }));
  const exactMatch = normalizedLanguages.find(
    (language) => language.code.toLowerCase() === normalizedRequestedLanguage.toLowerCase()
  );

  if (exactMatch) {
    return { ok: true, code: exactMatch.code };
  }

  return {
    ok: false,
    reason: "unknown",
    normalizedCode: normalizedRequestedLanguage,
    message: `Language '${normalizedRequestedLanguage}' is not configured for this survey`,
  };
}

export function getV3SurveyLanguages(
  survey: Pick<TInternalSurvey, "languages">,
  fallbackLanguage: string
): TV3SurveyLanguage[] {
  const languages = (survey.languages ?? []).map((surveyLanguage) => ({
    code: normalizeV3SurveyLanguageTag(surveyLanguage.language.code) ?? surveyLanguage.language.code,
    default: surveyLanguage.default,
    enabled: surveyLanguage.enabled,
  }));

  if (languages.length === 0) {
    return [{ code: fallbackLanguage, default: true, enabled: true }];
  }

  return languages;
}

export function getV3SurveyDefaultLanguage(
  survey: Pick<TInternalSurvey, "languages">,
  fallbackLanguage: string
): string {
  const defaultLanguageCode = survey.languages?.find((surveyLanguage) => surveyLanguage.default)?.language
    .code;

  return defaultLanguageCode
    ? (normalizeV3SurveyLanguageTag(defaultLanguageCode) ?? defaultLanguageCode)
    : fallbackLanguage;
}
