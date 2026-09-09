export const IMPORTED_SURVEY_NAME_SUFFIX = "(imported)";
const MAX_SURVEY_NAME_LENGTH = 200;

/**
 * Default name for the review step: the source survey's name plus an "(imported)" marker, so a
 * second import of the same file sits next to the first without a collision (D8). Idempotent: a
 * name that already carries the marker is not suffixed twice.
 */
export function getImportedSurveyName(
  sourceName: string | undefined | null,
  fallback = "Imported survey"
): string {
  const base = (sourceName ?? "").trim() || fallback;
  if (base.endsWith(IMPORTED_SURVEY_NAME_SUFFIX)) return base.slice(0, MAX_SURVEY_NAME_LENGTH);

  const suffixed = `${base} ${IMPORTED_SURVEY_NAME_SUFFIX}`;
  if (suffixed.length <= MAX_SURVEY_NAME_LENGTH) return suffixed;

  return `${base.slice(0, MAX_SURVEY_NAME_LENGTH - IMPORTED_SURVEY_NAME_SUFFIX.length - 1).trimEnd()} ${IMPORTED_SURVEY_NAME_SUFFIX}`;
}

export function getDocumentName(document: Record<string, unknown> | null | undefined): string | undefined {
  return document && typeof document.name === "string" ? document.name : undefined;
}
