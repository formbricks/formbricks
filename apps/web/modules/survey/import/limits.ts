import { AI_DEFAULT_TIMEOUT_MS } from "@formbricks/types/ai-timeout";
import { DEFAULT_REQUEST_BODY_LIMIT_BYTES } from "@/app/lib/api/request-body";

/**
 * The survey import's caps, shared by every lane (ENG-6846). Each lane enforces the ones that apply to
 * it at its earliest boundary; caps only one file type has (the Qualtrics reader's flow and block
 * counts, say) stay in that lane's own limits module, such as `qsf/limits.ts`.
 *
 * The dialog imports this module too, so it must stay free of server code and of heavy imports. Caps
 * the import inherits rather than owns are enforced by their owners and are not repeated here:
 *
 * - the v3 request budget (1,000 items per array, 50,000 in all, 256 levels of nesting), which a JSON
 *   file is held to before it is parsed: `app/api/v3/lib/array-budget.ts`;
 * - the survey document's own caps (languages, blocks, endings, hidden fields, variables, triggers),
 *   which the draft is held to by the create's checks: `V3_SURVEY_MAX_*` in
 *   `app/api/v3/surveys/schemas.ts`;
 * - the rate limits: the default v3 bucket for every upload, and a lane's own on top (`rateLimit` in
 *   `core/lane.ts`; Create with AI's bucket for a lane that spends AI tokens).
 */

/** The largest file the import takes: the dialog refuses a larger one, the route answers it with a 413. */
export const SURVEY_IMPORT_MAX_FILE_BYTES = 15 * 1024 * 1024;

/**
 * The largest request body the import route reads: 15.5 MiB, the 15 MiB file and the multipart framing
 * around it.
 *
 * Must stay below Next's `proxyClientMaxBodySize` (16 MB, `next.config.mjs`). The patched Next
 * (`patches/next@16.4.1.patch`) no longer clones bodies for the proxy, but without the patch Next truncates
 * a longer body before the route sees it instead of rejecting it, so an upload without a `Content-Length`
 * header would get a 400 for a malformed body rather than the route's 413. `limits.test.ts` holds the two
 * apart.
 */
export const SURVEY_IMPORT_MAX_BODY_BYTES = 15.5 * 1024 * 1024;

/*
 * The zip archives a `.docx` or `.xlsx` is (ENG-6848). Its central directory is checked against all four
 * before anything is inflated, from the counts and sizes it declares; the bytes a part inflates to are
 * then counted against the last three as they come out, since a directory can lie. Past any of them the
 * file is refused with a 413: each is a size limit.
 */

/** Entries one archive may list. A questionnaire is a few dozen parts; a workbook a few hundred at most. */
export const SURVEY_IMPORT_ZIP_MAX_ENTRIES = 1_000;

/**
 * Inflated bytes in one archive, all entries together: what its directory declares, and what reading its
 * parts actually inflates. Far above any questionnaire (a 15 MiB `.docx` of text inflates to well under
 * 100 MiB), low enough that three imports in flight stay inside the pod's memory.
 */
export const SURVEY_IMPORT_ZIP_MAX_INFLATED_BYTES = 200 * 1024 * 1024;

/**
 * Inflated bytes of one XML part (`.xml`, `.rels`), before it is parsed. The DOM of an XML document
 * weighs several times its text, so this is what bounds the parse.
 */
export const SURVEY_IMPORT_ZIP_MAX_PART_BYTES = 10 * 1024 * 1024;

/**
 * Inflated bytes per compressed byte, per entry. Office XML compresses about 10:1; DEFLATE's own ceiling
 * is about 1,032:1, which is what a zip bomb uses.
 */
export const SURVEY_IMPORT_ZIP_MAX_COMPRESSION_RATIO = 100;

/**
 * Imports one server process runs at once. The request budget is checked on the raw text before it is
 * parsed, so nesting and long arrays never reach `JSON.parse` (15.5 MiB of `[[[…]]]` would retain about
 * 470 MB). Measured on the worst 15.5 MiB body that does: one object with 1.2M keys holding `{}` retains
 * about 150 MB, the walk over it about 20 MB more, and the raw text 16 MB. Under 200 MB an import, so
 * three in flight stay under 600 MB, inside the pod's memory. The per-user rate limit does not cover
 * many users importing at the same time; this does.
 */
export const SURVEY_IMPORT_MAX_IN_FLIGHT = 3;

/** Imports one user runs at once on a server process, so one user cannot take every slot. */
export const SURVEY_IMPORT_MAX_IN_FLIGHT_PER_USER = 1;

/** `Retry-After` when every import slot is taken: about how long a typical import takes. */
export const SURVEY_IMPORT_RETRY_AFTER_SECONDS = 15;

/**
 * Hard stop for one import, before `AI_TIMEOUT_MULTIPLIER`. Each AI call gets at most
 * `SURVEY_IMPORT_AI_CALL_TIMEOUT_MS`, and never more than what is left of this less the assembly
 * reserve, so a slow call shortens the ones after it instead of running past the deadline. At the slow
 * end of the model (~31 s a call), the 150-question survey's two waves of calls and a retry wave take
 * about 93 s, leaving room for assembly.
 */
export const SURVEY_IMPORT_DEADLINE_MS = 120_000;

/**
 * Questions a survey may bring in: the most an AI lane plans, sized from the largest surveys the import
 * is built for (about 150 questions) with headroom. Unused questions (trashed, outside the flow) do not
 * count.
 */
export const SURVEY_IMPORT_MAX_QUESTIONS = 200;

/** Options of one question: its choices, or a matrix's rows and columns each. */
export const SURVEY_IMPORT_MAX_OPTIONS_PER_QUESTION = 200;

/**
 * One text's size before it is sanitized. DOMPurify's cost grows with the markup it parses: about
 * 0.2 ms for a short question on jsdom, 58 ms for a 1 MB inline image and 436 ms for 20,000 spans.
 * A text past either bound is refused with a report line instead of being parsed. The tags count the
 * `<` written as character references (`&lt;`, `&#60;`, …) too: decoded, the next parse reads them as
 * tags.
 */
export const SURVEY_IMPORT_MAX_TEXT_CHARS = 50_000;
export const SURVEY_IMPORT_MAX_TEXT_TAGS = 500;

/** Names from the file — the survey's, a block's, a question's label — are cut to this before use. */
export const SURVEY_IMPORT_MAX_NAME_CHARS = 200;

/**
 * The most a draft may weigh. The dialog creates it with `POST /api/v3/surveys`, whose body is capped at
 * `DEFAULT_REQUEST_BODY_LIMIT_BYTES`; 64 KiB less, so a draft the user renames or otherwise touches in
 * the dialog before creating it still fits.
 */
export const SURVEY_IMPORT_MAX_DRAFT_BYTES = DEFAULT_REQUEST_BODY_LIMIT_BYTES - 64 * 1024;

/*
 * The AI budget of a lane that plans with AI. What one import may spend in calls and tokens all
 * together is derived from these by the lane, from what its costliest valid file needs (`qsf/ai-plan.ts`).
 */

/**
 * The source data one import may send to the AI, all questions together, at the prompt limits a lane
 * chooses (~60k tokens). A file whose data cannot fit it is refused before any AI call.
 */
export const SURVEY_IMPORT_AI_MAX_SOURCE_CHARS = 240_000;

/** The model's output budget per call. Room for reasoning tokens as well as the plan. */
export const SURVEY_IMPORT_AI_MAX_OUTPUT_TOKENS_PER_CALL = 8192;

/**
 * Output a chunk is sized to expect: about 20 questions without logic, or 8 with two rules each.
 *
 * Sized by time, not by the 8,192-token budget. Gemini 2.5 Flash, the default, writes about 150–250
 * tokens a second with its thinking included, and thinks up to about 3,000 tokens before a plan. At
 * the slow end a chunk then takes about 2 s + (3,000 + 1,400) / 150 ≈ 31 s, well inside the 45 s call
 * timeout; a 3,000-token chunk took about 42 s, and on a live run one timed out.
 */
export const SURVEY_IMPORT_AI_CHUNK_OUTPUT_TOKENS = 1_400;

/**
 * Calls in flight at once, per import. The 150-question survey the import is built for is 8 chunks
 * (about 10,500 expected tokens): two waves of at most ~31 s, then a retry wave, about 95 s — inside the
 * deadline less the assembly reserve. Three at a time would take three waves before the retry, which
 * would not fit. Bounded, because the provider's tokens-per-minute is the real limit: four calls of at
 * most ~30k prompt tokens each.
 */
export const SURVEY_IMPORT_AI_MAX_PARALLEL_CALLS = 4;

/** One call's time budget, before `AI_TIMEOUT_MULTIPLIER`. */
export const SURVEY_IMPORT_AI_CALL_TIMEOUT_MS = AI_DEFAULT_TIMEOUT_MS;

/*
 * Creating a reviewed import (`POST /api/internal/surveys/imports`, ENG-6850).
 */

/**
 * The largest create or Update request (ENG-6850, ENG-6851): the draft, which `SURVEY_IMPORT_MAX_DRAFT_BYTES` bounds, and the
 * references it carries back — at most 50 action classes, 200 attribute keys, 300 shared fields and 50
 * languages, a few hundred KiB at their largest.
 */
export const SURVEY_IMPORT_MAX_CREATE_BODY_BYTES = DEFAULT_REQUEST_BODY_LIMIT_BYTES + 1024 * 1024;

/** How long an `Idempotency-Key` answers repeats with the survey its request created. */
export const SURVEY_IMPORT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * How long a key stays held while its request runs, so a request whose process died does not hold it
 * for the full 24 hours. Past the survey write's transaction budget (10 s to start, 20 s to run) with
 * room for the checks before it.
 */
export const SURVEY_IMPORT_IDEMPOTENCY_IN_FLIGHT_MS = 2 * 60 * 1000;

/** The longest `Idempotency-Key` the create takes; the dialog sends a UUID. */
export const SURVEY_IMPORT_IDEMPOTENCY_KEY_MAX_CHARS = 255;
