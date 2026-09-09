/**
 * Every hard limit of survey import, in one place. The lanes import from here; the docs copy the
 * numbers from here (ENG-3011). Change a number here and the report messages, the OpenAPI text and
 * the docs are the places to re-check.
 */

/** 15 MB per file (D3). The multipart transport adds 1 MB of framing slack on top. */
export const IMPORT_MAX_FILE_BYTES = 15 * 1024 * 1024;
/** Normalized document text handed to the model side is cut here (`text_truncated`). */
export const IMPORT_MAX_TEXT_CHARS = 400_000;
/** Estimated questions the chunker keeps; the remainder is dropped with `text_truncated`. */
export const IMPORT_MAX_QUESTIONS = 200;
/** DOCX / PDF parsers run under this budget. */
export const IMPORT_EXTRACT_TIMEOUT_MS = 10_000;
/** In-flight AI conversions one user may run at once; the next one answers 409 `import_in_progress`. */
export const IMPORT_AI_MAX_INFLIGHT_PER_USER = 2;
/** Safety net for a slot whose release never ran (crashed worker): seconds until Redis forgets it. */
export const IMPORT_AI_INFLIGHT_TTL_SECONDS = 120;
/** What a 409 tells the client to wait before retrying. */
export const IMPORT_AI_INFLIGHT_RETRY_AFTER_SECONDS = 30;
