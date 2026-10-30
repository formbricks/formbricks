/**
 * Transport settings of the import stream route (ENG-3604, ENG-3653). The import's caps — body size,
 * concurrency, deadline — are in `modules/survey/import/limits.ts`, shared by every lane.
 */

/** Longest silence on the stream. Well under nginx's 60 s default read timeout. */
export const SURVEY_IMPORT_HEARTBEAT_MS = 10_000;
