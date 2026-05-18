type TV3SurveyLanguageInput = {
  code: string;
  enabled: boolean;
};

type TResolveV3SurveyLanguageCodeResult =
  | { ok: true; code: string }
  | { ok: false; reason: "invalid" | "unknown" | "ambiguous"; message: string };

export function normalizeV3SurveyLanguageTag(value: string): string | null {
  const normalizedSeparators = value.trim().replaceAll("_", "-");

  try {
    return Intl.getCanonicalLocales(normalizedSeparators)[0] ?? null;
  } catch {
    return null;
  }
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
