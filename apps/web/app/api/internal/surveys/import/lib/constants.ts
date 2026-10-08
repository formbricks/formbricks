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
 * Imports one server process runs at once. The request budget is checked on the raw text before it is
 * parsed, so nesting and long arrays never reach `JSON.parse` (15.5 MiB of `[[[…]]]` would retain about
 * 470 MB). Measured on the worst 15.5 MiB body that does: one object with 1.2M keys holding `{}` retains
 * about 150 MB, the walk over it about 20 MB more, and the raw text 16 MB. Under 200 MB an import, so
 * three in flight stay under 600 MB, inside the pod's memory. The per-user rate limit does not cover
 * many users importing at the same time; this does.
 */
export const QSF_IMPORT_MAX_IN_FLIGHT = 3;

/** Imports one user runs at once on a server process, so one user cannot take every slot. */
export const QSF_IMPORT_MAX_IN_FLIGHT_PER_USER = 1;

/** `Retry-After` when every import slot is taken: about how long a typical import takes. */
export const QSF_IMPORT_RETRY_AFTER_SECONDS = 15;

/** Hard stop for one import: two waves of AI calls (45 s each at most), a retry wave, and assembly. */
export const QSF_IMPORT_DEADLINE_MS = 120_000;

/** Longest silence on the stream. Well under nginx's 60 s default read timeout. */
export const QSF_IMPORT_HEARTBEAT_MS = 10_000;
