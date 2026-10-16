/**
 * Archived surveys are permanently deleted this many days after they are archived (ENG-1042). Kept
 * apart from `constants.ts`, which reads server env, so client code (the data retention dialogs and
 * survey card) can state the same figure.
 */
export const SURVEY_ARCHIVE_RETENTION_DAYS = 30;
