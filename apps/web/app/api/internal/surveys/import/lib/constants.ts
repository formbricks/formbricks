/**
 * Limits of the Qualtrics import stream route (ENG-3604, ENG-3653).
 */

/**
 * The largest QSF body the route reads: 15.5 MiB. The product allows 15 MB files, and the JSON envelope
 * around the file adds a little.
 *
 * Must stay below Next's `proxyClientMaxBodySize` (16 MB, `next.config.mjs`). Next truncates a longer
 * body before the route sees it instead of rejecting it, so an upload without a `Content-Length` header
 * would get a 400 for malformed JSON rather than this route's 413. `constants.test.ts` holds the two
 * apart.
 */
export const QSF_IMPORT_BODY_LIMIT_BYTES = 15.5 * 1024 * 1024;

/**
 * Imports one server process runs at once. A parsed 15 MB JSON body can briefly take 100 MB or more of
 * heap, and the per-user rate limit does not cover many users importing at the same time.
 */
export const QSF_IMPORT_MAX_IN_FLIGHT = 3;

/** `Retry-After` when every import slot is taken: about how long a typical import takes. */
export const QSF_IMPORT_RETRY_AFTER_SECONDS = 15;

/** Hard stop for one import: the AI call (45 s), one retry of the questions that failed, and assembly. */
export const QSF_IMPORT_DEADLINE_MS = 120_000;

/** Longest silence on the stream. Well under nginx's 60 s default read timeout. */
export const QSF_IMPORT_HEARTBEAT_MS = 10_000;
