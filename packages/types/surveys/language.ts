type TSurveyLanguageLike = {
  default?: boolean | null;
  enabled?: boolean | null;
  language: {
    code: string;
    alias?: string | null;
  };
};

interface ResolveSurveyLanguageInput<T extends TSurveyLanguageLike> {
  languages: T[];
  explicitLanguageCode?: string;
  browserLanguageCodes?: string[];
  autoSelectLanguage?: boolean | null;
  unmatchedExplicitLanguageBehavior?: "fallback" | "undefined";
}

export const normalizeLanguageCode = (languageCode: string): string =>
  languageCode.trim().split(";")[0].trim().replace("_", "-").toLowerCase();

const getBaseLanguageCode = (languageCode: string): string =>
  normalizeLanguageCode(languageCode).split("-")[0];

const getSelectableLanguageCode = (surveyLanguage: TSurveyLanguageLike): string | undefined => {
  if (surveyLanguage.default) return "default";
  if (!surveyLanguage.enabled) return undefined;
  return surveyLanguage.language.code;
};

const findExactLanguageMatch = <T extends TSurveyLanguageLike>(
  languages: T[],
  languageCode: string
): string | undefined => {
  const normalizedLanguageCode = normalizeLanguageCode(languageCode);

  const selectedLanguage = languages.find((surveyLanguage) => {
    return (
      normalizeLanguageCode(surveyLanguage.language.code) === normalizedLanguageCode ||
      (surveyLanguage.language.alias
        ? normalizeLanguageCode(surveyLanguage.language.alias) === normalizedLanguageCode
        : false)
    );
  });

  return selectedLanguage ? getSelectableLanguageCode(selectedLanguage) : undefined;
};

const findLooseLanguageMatch = <T extends TSurveyLanguageLike>(
  languages: T[],
  languageCode: string
): string | undefined => {
  const baseLanguageCode = getBaseLanguageCode(languageCode);

  for (const surveyLanguage of languages) {
    const selectableLanguageCode = getSelectableLanguageCode(surveyLanguage);
    if (!selectableLanguageCode) continue;

    const languageBaseCode = getBaseLanguageCode(surveyLanguage.language.code);
    const aliasBaseCode = surveyLanguage.language.alias
      ? getBaseLanguageCode(surveyLanguage.language.alias)
      : undefined;

    if (languageBaseCode === baseLanguageCode || aliasBaseCode === baseLanguageCode) {
      return selectableLanguageCode;
    }
  }

  return undefined;
};

export const matchSurveyLanguage = <T extends TSurveyLanguageLike>(
  languages: T[],
  languageCode: string
): string | undefined => {
  return findExactLanguageMatch(languages, languageCode) ?? findLooseLanguageMatch(languages, languageCode);
};

/**
 * Resolves survey language precedence without coupling callers to a delivery channel:
 * explicit language (URL or SDK/user setting) -> browser languages when enabled -> survey default.
 */
export const resolveSurveyLanguage = <T extends TSurveyLanguageLike>({
  languages,
  explicitLanguageCode,
  browserLanguageCodes = [],
  autoSelectLanguage,
  unmatchedExplicitLanguageBehavior = "fallback",
}: ResolveSurveyLanguageInput<T>): string | undefined => {
  if (explicitLanguageCode) {
    const explicitMatch = matchSurveyLanguage(languages, explicitLanguageCode);
    if (explicitMatch) return explicitMatch;
    return unmatchedExplicitLanguageBehavior === "undefined" ? undefined : "default";
  }

  if (!autoSelectLanguage) return "default";

  for (const browserLanguageCode of browserLanguageCodes) {
    const exactMatch = findExactLanguageMatch(languages, browserLanguageCode);
    if (exactMatch) return exactMatch;
  }

  for (const browserLanguageCode of browserLanguageCodes) {
    const looseMatch = findLooseLanguageMatch(languages, browserLanguageCode);
    if (looseMatch) return looseMatch;
  }

  return "default";
};
