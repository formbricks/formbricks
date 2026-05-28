import type { TSurvey as TInternalSurvey } from "@formbricks/types/surveys/types";

export type TV3SurveyResolverLanguage = {
  code: string;
  enabled: boolean;
  alias?: string | null;
};

export type TV3SurveyLanguage = {
  code: string;
  default: boolean;
  enabled: boolean;
  alias?: string | null;
};

type TV3SurveyLanguageQueryInput = string | string[];

type TResolveV3SurveyLanguageCodeResult =
  | { ok: true; code: string }
  | { ok: false; reason: "ambiguous" | "invalid" | "unknown"; message: string; normalizedCode?: string };

type TParseV3SurveyLanguageQueryResult = { ok: true; languages: string[] } | { ok: false; message: string };

const V3_SURVEY_LANGUAGE_TAG_REGEX = /^[a-z]{2}(?:-[A-Z]{2}|-[A-Z][a-z]{3}(?:-[A-Z]{2})?)$/;
const V3_SURVEY_LOCALE_CODE_REGEX = /^[a-z]{2}(?:-[A-Z][a-z]{3})?-[A-Z]{2}$/;
const V3_LEGACY_LANGUAGE_CODE_MAP: Record<string, string> = {
  ar: "ar-SA",
  cs: "cs-CZ",
  da: "da-DK",
  de: "de-DE",
  en: "en-US",
  es: "es-ES",
  fi: "fi-FI",
  fr: "fr-FR",
  he: "he-IL",
  hi: "hi-IN",
  hu: "hu-HU",
  it: "it-IT",
  ja: "ja-JP",
  ko: "ko-KR",
  nb: "nb-NO",
  nl: "nl-NL",
  no: "nb-NO",
  pl: "pl-PL",
  ro: "ro-RO",
  ru: "ru-RU",
  sv: "sv-SE",
  tr: "tr-TR",
};

export function normalizeV3SurveyLanguageTag(value: string): string | null {
  return normalizeV3SurveyLanguageCode(value, V3_SURVEY_LANGUAGE_TAG_REGEX);
}

export function normalizeV3SurveyLocaleCode(value: string): string | null {
  return normalizeV3SurveyLanguageCode(value, V3_SURVEY_LOCALE_CODE_REGEX);
}

function normalizeV3SurveyLanguageCode(value: string, pattern: RegExp): string | null {
  const normalizedSeparators = value.trim().replaceAll("_", "-");

  try {
    const normalizedLanguage = Intl.getCanonicalLocales(normalizedSeparators)[0] ?? null;
    if (!normalizedLanguage || !pattern.test(normalizedLanguage)) {
      return null;
    }

    return normalizedLanguage;
  } catch {
    return null;
  }
}

export function normalizeV3SurveyLanguageIdentifier(value: string): string | null {
  return (
    normalizeV3SurveyLanguageTag(value) ?? V3_LEGACY_LANGUAGE_CODE_MAP[value.trim().toLowerCase()] ?? null
  );
}

function getLanguageSelectorKey(value: string): string {
  return normalizeV3SurveyLanguageTag(value)?.toLowerCase() ?? value.trim().toLowerCase();
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
      message: "Language selector must contain valid comma-separated language selectors",
    };
  }

  const languages: string[] = [];
  const languageKeys = new Set<string>();

  for (const language of requestedLanguages) {
    const languageKey = getLanguageSelectorKey(language);

    if (!languageKeys.has(languageKey)) {
      languageKeys.add(languageKey);
      languages.push(language);
    }
  }

  return { ok: true, languages };
}

function getLanguageBase(code: string): string | null {
  const normalizedCode = normalizeV3SurveyLanguageIdentifier(code);

  if (normalizedCode) {
    return normalizedCode.split("-")[0].toLowerCase();
  }

  return /^[a-z]{2,3}$/i.test(code) ? code.toLowerCase() : null;
}

function isLanguageOnlySelector(code: string): boolean {
  return /^[a-z]{2,3}$/i.test(code);
}

function getNormalizedLanguage(language: TV3SurveyResolverLanguage) {
  const code = normalizeV3SurveyLanguageIdentifier(language.code) ?? language.code;
  const alias = getV3SurveyLanguageAlias(language.alias);

  return {
    ...language,
    code,
    originalCode: language.code,
    alias,
    normalizedAlias: alias ? normalizeV3SurveyLanguageIdentifier(alias) : null,
  };
}

function getV3SurveyLanguageAlias(alias: string | null | undefined): string | null {
  return alias?.trim() || null;
}

function createAmbiguousLanguageResult(
  requestedLanguage: string,
  normalizedCode: string | null,
  matchingCodes: string[]
): TResolveV3SurveyLanguageCodeResult {
  return {
    ok: false,
    reason: "ambiguous",
    normalizedCode: normalizedCode ?? requestedLanguage,
    message: `Language '${requestedLanguage}' is ambiguous for this survey. Matching languages: ${matchingCodes.join(
      ", "
    )}`,
  };
}

export function resolveV3SurveyLanguageCode(
  requestedLanguage: string,
  languages: TV3SurveyResolverLanguage[]
): TResolveV3SurveyLanguageCodeResult {
  const requestedLanguageValue = requestedLanguage.trim();
  const requestedLanguageKey = requestedLanguageValue.toLowerCase();
  const normalizedRequestedLanguage = normalizeV3SurveyLanguageTag(requestedLanguageValue);

  const normalizedLanguages = languages.map(getNormalizedLanguage);
  const requestedLanguageBase = getLanguageBase(requestedLanguageValue);

  if (isLanguageOnlySelector(requestedLanguageValue) && requestedLanguageBase) {
    const baseMatchCodes = Array.from(
      new Set(
        normalizedLanguages
          .filter((language) => getLanguageBase(language.code) === requestedLanguageBase)
          .map((language) => language.code)
      )
    );

    if (baseMatchCodes.length > 1) {
      return createAmbiguousLanguageResult(
        requestedLanguageValue,
        normalizedRequestedLanguage,
        baseMatchCodes
      );
    }
  }

  let matches = normalizedLanguages.filter(
    (language) =>
      language.originalCode.toLowerCase() === requestedLanguageKey ||
      language.alias?.toLowerCase() === requestedLanguageKey ||
      (normalizedRequestedLanguage &&
        (language.code.toLowerCase() === normalizedRequestedLanguage.toLowerCase() ||
          language.normalizedAlias?.toLowerCase() === normalizedRequestedLanguage.toLowerCase()))
  );

  if (matches.length === 0 && isLanguageOnlySelector(requestedLanguageValue) && requestedLanguageBase) {
    matches = normalizedLanguages.filter(
      (language) => getLanguageBase(language.code) === requestedLanguageBase
    );
  }

  const matchCodes = Array.from(new Set(matches.map((language) => language.code)));

  if (matchCodes.length === 1) {
    return { ok: true, code: matchCodes[0] };
  }

  if (matchCodes.length > 1) {
    return createAmbiguousLanguageResult(requestedLanguageValue, normalizedRequestedLanguage, matchCodes);
  }

  if (!normalizedRequestedLanguage) {
    if (isLanguageOnlySelector(requestedLanguageValue)) {
      return {
        ok: false,
        reason: "unknown",
        normalizedCode: requestedLanguageValue,
        message: `Language '${requestedLanguageValue}' is not configured for this survey`,
      };
    }

    return {
      ok: false,
      reason: "invalid",
      message: `Language '${requestedLanguageValue}' is not a valid locale code or configured language alias`,
    };
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
  const languages = (survey.languages ?? []).map((surveyLanguage) => {
    const alias = getV3SurveyLanguageAlias(surveyLanguage.language.alias);

    return {
      code: normalizeV3SurveyLanguageIdentifier(surveyLanguage.language.code) ?? surveyLanguage.language.code,
      default: surveyLanguage.default,
      enabled: surveyLanguage.enabled,
      alias,
    };
  });

  if (languages.length === 0) {
    return [{ code: fallbackLanguage, default: true, enabled: true }];
  }

  return languages;
}

export function getV3SurveyResolverLanguages(
  survey: Pick<TInternalSurvey, "languages">,
  fallbackLanguage: string
): TV3SurveyResolverLanguage[] {
  const languages = (survey.languages ?? []).map((surveyLanguage) => ({
    code: normalizeV3SurveyLanguageIdentifier(surveyLanguage.language.code) ?? surveyLanguage.language.code,
    enabled: surveyLanguage.enabled,
    alias: getV3SurveyLanguageAlias(surveyLanguage.language.alias),
  }));

  if (languages.length === 0) {
    return [{ code: fallbackLanguage, enabled: true }];
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
    ? (normalizeV3SurveyLanguageIdentifier(defaultLanguageCode) ?? defaultLanguageCode)
    : fallbackLanguage;
}
