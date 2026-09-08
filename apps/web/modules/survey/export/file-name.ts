export const SURVEY_EXPORT_FILE_SUFFIX = ".formbricks.json";
const FALLBACK_BASE_NAME = "survey";
const MAX_BASE_NAME_LENGTH = 80;

/**
 * Kebab-case a survey name into a safe file base name: ASCII letters and digits only, hyphens between
 * words, diacritics folded (`Café` → `cafe`), everything else (slashes, quotes, emoji, CJK) dropped.
 * An empty result falls back to `survey`.
 */
export function toSurveyExportBaseName(name: string): string {
  const folded = name
    .normalize("NFKD")
    .replaceAll(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, MAX_BASE_NAME_LENGTH)
    .replaceAll(/-+$/g, "");

  return folded.length > 0 ? folded : FALLBACK_BASE_NAME;
}

export function getSurveyExportFileName(survey: { name: string }): string {
  return `${toSurveyExportBaseName(survey.name)}${SURVEY_EXPORT_FILE_SUFFIX}`;
}
