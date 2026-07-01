import { normalizeLanguageCode } from "@formbricks/i18n-utils/src/canonical";
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

// Validate + case/separator-normalize a fully region/script-qualified BCP-47 tag. This only recognises a
// valid tag — it does NOT canonicalize or complete it (`zh-Hans` stays `zh-Hans`, `zh-CN` stays `zh-CN`).
// Canonicalization is `normalizeLanguageCode`'s job; this is used for tag recognition and query dedup.
// Returns null for bare/underspecified/invalid input.
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

const canonicalKey = (value: string): string | null => normalizeLanguageCode(value)?.toLowerCase() ?? null;

export function normalizeV3SurveyWriteLanguageCode(
  value: string,
  allowedLanguageCodes?: Iterable<string>
): string | null {
  // PATCH: if the request resolves to a language ALREADY configured on the survey, write that survey's
  // STORED code as-is — its content i18n keys are keyed by exactly that code. Post-migration the stored
  // code is already canonical; a client still sending a legacy/script form matches by canonical
  // equivalence. Never rewrite it here (even for a canonical/script-complete input), or the write would
  // orphan the survey's existing content keys. This match runs BEFORE canonicalization so preserve wins.
  if (allowedLanguageCodes) {
    const requestedKey = value.trim().toLowerCase();
    const requestedCanonical = canonicalKey(value);

    for (const allowedLanguageCode of allowedLanguageCodes) {
      if (
        requestedKey === allowedLanguageCode.toLowerCase() ||
        (requestedCanonical && requestedCanonical === canonicalKey(allowedLanguageCode))
      ) {
        return allowedLanguageCode;
      }
    }
  }

  // CREATE (or a genuinely new language added via PATCH): accept a full locale and canonicalize it, so a
  // newly stored code is always canonical (`zh-CN` -> `zh-Hans-CN`) while legitimate non-default regions
  // are preserved (`de-AT` stays `de-AT`, `en-GB` stays `en-GB`). Bare/invalid codes stay rejected (null).
  const normalizedLocale = normalizeV3SurveyLocaleCode(value);
  if (normalizedLocale) {
    return normalizeLanguageCode(normalizedLocale) ?? normalizedLocale;
  }

  return null;
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

// Base language subtag (`de-AT` -> `de`, `zh-Hans-CN` -> `zh`), or null when there's no valid 2-3 letter
// base. Map-independent: only used to resolve/deduplicate bare language selectors.
function getLanguageBase(code: string): string | null {
  const base = code.trim().toLowerCase().split(/[-_]/)[0];
  return /^[a-z]{2,3}$/.test(base) ? base : null;
}

function isLanguageOnlySelector(code: string): boolean {
  return /^[a-z]{2,3}$/i.test(code);
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
  const requestedLanguageBase = getLanguageBase(requestedLanguageValue);

  // A bare language selector that matches more than one configured region/script is ambiguous.
  if (isLanguageOnlySelector(requestedLanguageValue) && requestedLanguageBase) {
    const baseMatchCodes = Array.from(
      new Set(
        languages
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

  // 1. Exact stored code or alias (case-insensitive) — always wins.
  let matches = languages.filter(
    (language) =>
      language.code.toLowerCase() === requestedLanguageKey ||
      getV3SurveyLanguageAlias(language.alias)?.toLowerCase() === requestedLanguageKey
  );

  // 2. Canonical equivalence — a legacy/script/region/underscore selector resolves to the language whose
  // canonical BCP-47 form matches (`?lang=zh-Hans` or `?lang=zh-CN` -> a stored `zh-Hans-CN`; `?lang=DE_de`
  // -> `de-DE`). Runs only on zero exact matches, so an exact stored-code match always wins.
  if (matches.length === 0) {
    const requestedCanonical = canonicalKey(normalizedRequestedLanguage ?? requestedLanguageValue);
    if (requestedCanonical) {
      matches = languages.filter((language) => {
        const alias = getV3SurveyLanguageAlias(language.alias);
        return (
          canonicalKey(language.code) === requestedCanonical ||
          (alias ? canonicalKey(alias) === requestedCanonical : false)
        );
      });
    }
  }

  // 3. Base-language fallback for a bare selector (`?lang=pt` -> the single `pt-*` language).
  if (matches.length === 0 && isLanguageOnlySelector(requestedLanguageValue) && requestedLanguageBase) {
    matches = languages.filter((language) => getLanguageBase(language.code) === requestedLanguageBase);
  }

  // Return the survey's STORED code (canonical post-migration) so it lines up exactly with its content
  // i18n keys. Matching above already canonicalized the request; we only rewrite what we store, never
  // what we hand back for an existing survey.
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
  const languages = (survey.languages ?? []).map((surveyLanguage) => ({
    code: surveyLanguage.language.code,
    default: surveyLanguage.default,
    enabled: surveyLanguage.enabled,
    alias: getV3SurveyLanguageAlias(surveyLanguage.language.alias),
  }));

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
    code: surveyLanguage.language.code,
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

  return defaultLanguageCode ?? fallbackLanguage;
}
