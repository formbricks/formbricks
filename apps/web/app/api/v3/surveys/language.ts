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
  | { ok: false; reason: "invalid" | "unknown" | "ambiguous"; message: string };

type TParseV3SurveyLanguageQueryResult = { ok: true; languages: string[] } | { ok: false; message: string };

export function normalizeV3SurveyLanguageTag(value: string): string | null {
  const normalizedSeparators = value.trim().replaceAll("_", "-");

  try {
    return Intl.getCanonicalLocales(normalizedSeparators)[0] ?? null;
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

function getLanguageSubtag(languageTag: string): string {
  return languageTag.split("-")[0]?.toLowerCase() ?? languageTag.toLowerCase();
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

  const requestedSubtag = getLanguageSubtag(normalizedRequestedLanguage);
  const hasRegionOrScript = normalizedRequestedLanguage.includes("-");
  const matchingLanguages = hasRegionOrScript
    ? []
    : normalizedLanguages.filter((language) => getLanguageSubtag(language.code) === requestedSubtag);

  if (matchingLanguages.length > 1) {
    return {
      ok: false,
      reason: "ambiguous",
      message: `Language '${normalizedRequestedLanguage}' is ambiguous for this survey; use one of ${matchingLanguages.map((language) => language.code).join(", ")}`,
    };
  }

  const languageMatch = matchingLanguages[0];
  if (languageMatch) {
    return { ok: true, code: languageMatch.code };
  }

  return {
    ok: false,
    reason: "unknown",
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
