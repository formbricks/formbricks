import { DEFAULT_REQUEST_BODY_LIMIT_BYTES } from "@/app/lib/api/request-body";

/**
 * The survey import's caps (ENG-6846), in one place: those every lane shares, and those of the document
 * lanes, the AI plan and the report. Each lane enforces the ones that apply to it at its earliest
 * boundary. The Qualtrics reader's own structure caps (its flow and block counts) stay in `qsf/limits.ts`.
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

/*
 * A document import's question list (ENG-6852): the first sheet of a `.xlsx`, or a `.csv`. Past any of
 * these the file is refused with a 422 naming the limit, before any AI call.
 */

/** Rows of the sheet or the CSV, empty ones included up to the last one with text. */
export const SURVEY_IMPORT_SHEET_MAX_ROWS = 5_000;

/** Columns of the sheet or the CSV, up to the last one with text. */
export const SURVEY_IMPORT_SHEET_MAX_COLUMNS = 100;

/** Characters of one cell or CSV field: Excel's own cap, so only a file not written by Excel is past it. */
export const SURVEY_IMPORT_SHEET_MAX_CELL_CHARS = 32_767;

/*
 * The XML parts of a `.docx` (ENG-6853). Each part's inflated bytes are capped by the zip guard before
 * it is read (`SURVEY_IMPORT_ZIP_MAX_PART_BYTES`); its shape is then checked against these on the raw
 * text, before the DOM parser allocates a node. Past either, the file is refused with a 422.
 */

/** Levels of element nesting in one part. Word nests a few levels per table; real files stay under 40. */
export const SURVEY_IMPORT_XML_MAX_DEPTH = 256;

/**
 * Elements in one file, all its XML parts together: a part read twice counts twice. A 150-question
 * questionnaire's document is about 15,000. This bounds the DOMs the Word reader builds, which cost
 * about 2 KB an element with Office's attributes while parsing: 499,000 elements in one part peaked near
 * 1 GB, and a file whose relationships made the reader parse that part three times needed over 1.2 GB of
 * heap (2026-11-04). The total is what bounds memory, not any one part.
 */
export const SURVEY_IMPORT_XML_MAX_ELEMENTS = 150_000;

/**
 * Attributes in one file, all its XML parts together. A DOM attribute weighs about what an element
 * does, so they are bounded like elements: twice the element budget, since Office writes about two to
 * an element.
 */
export const SURVEY_IMPORT_XML_MAX_ATTRIBUTES = 300_000;

/*
 * A Word questionnaire's body (ENG-6853): its paragraphs, tables and table cells, counted as the reader
 * walks the document, nested tables included. Past any, the file is refused with a 422 naming it.
 */

/** Paragraphs, in the body and in table cells, empty ones included. */
export const SURVEY_IMPORT_WORD_MAX_PARAGRAPHS = 20_000;

/** Tables, nested ones included. */
export const SURVEY_IMPORT_WORD_MAX_TABLES = 500;

/** Table cells, in every table together. */
export const SURVEY_IMPORT_WORD_MAX_TABLE_CELLS = 50_000;

/*
 * How far the Word reader follows what a file declares. Past these it stops following instead of
 * refusing the file, so each bounds the work one declaration can cost.
 */

/** Styles an inherited property is looked up through (`basedOn`), at most: a cycle stops here. */
export const SURVEY_IMPORT_WORD_MAX_STYLE_CHAIN = 20;

/**
 * The largest list number written as letters or numerals: Word's own limit on a list's start. A file
 * can claim any start; past this a number is written in digits, so a huge one costs nothing to label.
 */
export const SURVEY_IMPORT_WORD_MAX_FORMATTED_NUMBER = 32_767;

/**
 * The most letters a list number is written in: about as wide as the longest numeral under
 * `SURVEY_IMPORT_WORD_MAX_FORMATTED_NUMBER` (41 characters). Letters repeat with the number (aa…zz,
 * then aaa…), so past this it is digits too.
 */
export const SURVEY_IMPORT_WORD_MAX_NUMBER_LETTERS = 40;

/**
 * A list level's label pattern, and the label made from it: Word's own are a few characters (`%1.`,
 * `Q%1`, `%1.%2.`). A file's longer pattern is cut, or every numbered paragraph would rebuild it whole.
 */
export const SURVEY_IMPORT_WORD_MAX_LIST_LABEL_CHARS = 255;

/**
 * Imports one server process runs at once. Memory is what this bounds; the server's thread is kept free
 * by reading each file in a thread of its own (`core/upload-thread.ts`), one at a time
 * (`SURVEY_IMPORT_MAX_READ_THREADS`). The request budget is checked on the raw text before it is parsed,
 * so nesting and long arrays never reach `JSON.parse` (15.5 MiB of `[[[…]]]` would retain about 470 MB).
 * Measured on the worst 15 MiB body that does, one object with 1.2M keys holding `{}`, sent as a
 * Formbricks file: three such imports at once raised a process from 235 MB to a peak of about 1.2 GB of
 * RSS, inside the web pod's 2 GiB (2026-10-31). A production build under the same load rose about
 * 450 MB, stayed up, and answered every other request within 40 ms. Object keys are not budgeted, since a large multilingual
 * Qualtrics export legitimately holds hundreds of thousands. The per-user rate limit does not cover many
 * users importing at the same time; this does.
 */
export const SURVEY_IMPORT_MAX_IN_FLIGHT = 3;

/**
 * Upload threads one process runs at once (`core/upload-thread.ts`); the next upload waits its turn.
 * Threads that run at once hold their files at once, so this bounds the memory reading takes.
 */
export const SURVEY_IMPORT_MAX_READ_THREADS = 1;

/**
 * How long an upload's thread may take to tell the file's type and read it for its lane
 * (`core/upload-thread.ts`), each step on its own. Past it the file is refused with a 422. One upload
 * reads at a time, so this also bounds how long the next one waits. The costliest file the upload's
 * limits let through, 15 MiB of a million small objects as a Formbricks file, takes about 1.7 s on a
 * laptop (2026-10-31); a busy pod is slower.
 */
export const SURVEY_IMPORT_READ_TIME_MS = 15_000;

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

/**
 * Questions a document's answers may start before planning stops early: the ceiling with a quarter's
 * margin. The count is taken before the plan's checks, so it includes entries the checks or the retry
 * later drop; the margin keeps a file at the ceiling from being refused for those, and the exact count
 * after planning refuses one between the two. A file past this is almost certainly past the ceiling.
 */
export const SURVEY_IMPORT_PLANNING_STOP_QUESTIONS = Math.ceil(SURVEY_IMPORT_MAX_QUESTIONS * 1.25);

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
 * Names read to number what an import creates ("<name> (imported N)"): the workspace's names that start
 * like a candidate, for a survey or for the action classes of one file. Past this many, the lowest free
 * number is chosen among the names read, which only a workspace with over a thousand copies of one
 * import can get wrong.
 */
export const SURVEY_IMPORT_MAX_TAKEN_NAMES = 1_000;

/**
 * A language code as a file or an AI plan writes it, before it is trimmed: longer than any code the
 * import's pattern admits (30) with room for spaces (`core/language-codes.ts`).
 */
export const SURVEY_IMPORT_MAX_LANGUAGE_CODE_CHARS = 64;

/** Longest note or skip reason from an AI plan the report carries (`core/clean-note.ts`). */
export const SURVEY_IMPORT_MAX_NOTE_CHARS = 300;

/**
 * The most a draft may weigh: the v3 survey write's body cap, `DEFAULT_REQUEST_BODY_LIMIT_BYTES`, which
 * the survey is saved under once created; 64 KiB less, so a draft the user renames or otherwise
 * touches in the dialog before creating it still fits.
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

/**
 * A Markdown file's characters, markup included, before it is parsed: twice what one import may send to
 * the AI, so a questionnaire whose text could fit is not refused for its markup. The parser reads the
 * whole text and builds its token stream before any other limit applies, and crafted markup is costly:
 * at this cap the worst inputs measured peaked at about 165 MB (a nested quote and list per line) and
 * 0.9 s (a run of image openers), inside the reader's documented worst cases (`upload-thread.ts`).
 */
export const SURVEY_IMPORT_MARKDOWN_MAX_CHARS = 2 * SURVEY_IMPORT_AI_MAX_SOURCE_CHARS;

/**
 * The start of a text upload `looksLikeMarkdown` reads to tell Markdown from a CSV: enough for a
 * questionnaire's first headings, lists or table, and bounded, so classifying a 15 MiB file of short
 * lines no longer builds arrays of every line (about 500 MB measured).
 */
export const SURVEY_IMPORT_MARKDOWN_SNIFF_CHARS = 64 * 1024;

/**
 * The model's output budget per call, reasoning tokens included. With thinking on (`core/ai-plan.ts`),
 * Gemini 2.5 Flash thinks 1,000–6,600 tokens before a plan, and a plan of a 17-question table is about
 * 4,400 tokens, so 8,192 cut off most calls on such a file; at 16,384 the largest seen was 9,668. Token
 * cost is not the bound here, a complete import is: a call that runs long is cut by its time instead.
 */
export const SURVEY_IMPORT_AI_MAX_OUTPUT_TOKENS_PER_CALL = 16_384;

/**
 * Output a chunk is sized to expect: about 20 questions without logic, or 8 with two rules each.
 *
 * Sized by time, not by the per-call token budget. Gemini 2.5 Flash, the default, writes about 150–250
 * tokens a second with its thinking included, and thinks up to about 3,000 tokens before a plan. At
 * the slow end a chunk then takes about 2 s + (3,000 + 1,400) / 150 ≈ 31 s, well inside the 45 s call
 * timeout; a 3,000-token chunk took about 42 s, and on a live run one timed out.
 */
export const SURVEY_IMPORT_AI_CHUNK_OUTPUT_TOKENS = 1_400;

/**
 * A document chunk's expected output, by `document/chunks.ts`'s estimate: about 28 lines of a
 * questionnaire (7–10 questions with their options), well under the Qualtrics lane's. A document plan
 * quotes its texts back, and with thinking on Gemini 2.5 Flash spent 120–180 output tokens a line,
 * thoughts included, about six times the estimate: an 85-line chunk ran past 8,192 tokens in about 30 s,
 * a 43-line one took 20–33 s. At this size a call takes about 10–20 s, so the 150-question survey's
 * ~22 chunks plan in under two waves of `SURVEY_IMPORT_DOCUMENT_MAX_PARALLEL_CALLS`, with time left for a retry.
 */
export const SURVEY_IMPORT_DOCUMENT_CHUNK_OUTPUT_TOKENS = 500;

/**
 * Calls in flight at once, per import. The 150-question survey the import is built for is 8 chunks
 * (about 10,500 expected tokens): two waves of at most ~31 s, then a retry wave, about 95 s — inside the
 * deadline less the assembly reserve. Three at a time would take three waves before the retry, which
 * would not fit. Bounded, because the provider's tokens-per-minute is the real limit: four calls of at
 * most ~30k prompt tokens each.
 */
export const SURVEY_IMPORT_AI_MAX_PARALLEL_CALLS = 4;

/**
 * A document import's calls in flight at once, more than a Qualtrics import's: a document chunk is
 * smaller (`SURVEY_IMPORT_DOCUMENT_CHUNK_OUTPUT_TOKENS`), so the 150-question document plans in about
 * 22 chunks of 10–25 s each. Sixteen at a time plans them in under two waves, leaving time for the halves
 * of a chunk that ran out of time and for the retry round; at four a time it took six waves and ran out
 * of time, and at ten a single slow chunk in the third wave left no time for its halves. Bounded, because
 * the provider's tokens-per-minute is the real limit: sixteen calls of under 5k prompt tokens each.
 */
export const SURVEY_IMPORT_DOCUMENT_MAX_PARALLEL_CALLS = 16;

/** One call's time budget, before `AI_TIMEOUT_MULTIPLIER`. */
export { AI_DEFAULT_TIMEOUT_MS as SURVEY_IMPORT_AI_CALL_TIMEOUT_MS } from "@formbricks/types/ai-timeout";

/**
 * One document call's time budget, before `AI_TIMEOUT_MULTIPLIER`: shorter than a Qualtrics call's.
 * A document chunk is sized to take 10–20 s (`SURVEY_IMPORT_DOCUMENT_CHUNK_OUTPUT_TOKENS`), and the
 * longest answer seen (9,668 tokens, a 12-question table in one chunk) took about 36 s; but now and then
 * a thinking model keeps thinking until it is cut off, and at 45 s such a call and then its halves spent
 * half the import's time. At 40 s it is split sooner, and the 150-question document still finishes in
 * about a minute.
 */
export const SURVEY_IMPORT_DOCUMENT_CALL_TIMEOUT_MS = 40_000;

/** Retries per call after the first attempt: the AI SDK's default `maxRetries` (`core/call-retry.ts`). */
export const SURVEY_IMPORT_MAX_CALL_RETRIES = 2;

/** Time kept back for assembly when a call is sized against the deadline (`core/ai-plan.ts`). */
export const SURVEY_IMPORT_ASSEMBLY_RESERVE_MS = 5_000;

/**
 * The least time a call is sent with. Below it no plan can come back: the first token alone takes
 * 1–3 s, and even a 10-question half needs ~700 tokens and its thinking at 150–250 tokens a second.
 * Such a call would only time out after paying for its prompt, so its units are left unplanned
 * (`ai_budget`, like any call the import has no time left for).
 */
export const SURVEY_IMPORT_MIN_CALL_TIMEOUT_MS = 5_000;

/*
 * What an AI plan may hold, in either lane (`qsf/plan-schema.ts`, `document/plan-schema.ts`). The plan
 * is untrusted output, so these bound what a hostile or broken response costs to check; an entry past
 * one fails its schema and goes to the retry round, a whole answer past one fails its call.
 */

/** Entries in one answer: questions, skips, and (Qualtrics) pages, each list on its own. */
export const SURVEY_IMPORT_PLAN_MAX_ENTRIES = 1_000;

/**
 * One note or skip reason as the model writes it, before `cleanNote` cuts it to
 * `SURVEY_IMPORT_MAX_NOTE_CHARS` for the report.
 */
export const SURVEY_IMPORT_PLAN_MAX_RAW_NOTE_CHARS = 4_000;

/** A ref or key the plan names (`QID3`, `c12`, `C12`): the file's own are a few characters. */
export const SURVEY_IMPORT_PLAN_MAX_REF_CHARS = 20;

/** The element type or kind an entry names, before it is checked against the lane's allowlist. */
export const SURVEY_IMPORT_PLAN_MAX_TYPE_CHARS = 40;

/**
 * Options of a ranking question: the ranking element's own cap (`packages/types/surveys/elements.ts`),
 * checked on the plan so a ranking past it goes to the retry round instead of failing the create.
 */
export const SURVEY_IMPORT_PLAN_MAX_RANKING_OPTIONS = 25;

/**
 * Option keys one Qualtrics entry may leave out (`excludedKeys`): every key of a question's two lists,
 * choices and answers, at `SURVEY_IMPORT_MAX_OPTIONS_PER_QUESTION` each.
 */
export const SURVEY_IMPORT_QSF_PLAN_MAX_EXCLUDED_KEYS = 400;

/** Logic notes kept per Qualtrics question or page, one per rule; the rest are dropped, not refused. */
export const SURVEY_IMPORT_QSF_PLAN_MAX_NOTES_PER_ENTRY = 20;

/** Pieces of one document text slot (one per language), and languages the plan may name. */
export const SURVEY_IMPORT_DOCUMENT_PLAN_MAX_PIECES = 60;

/**
 * Options or columns of one document entry, and values one of its rules compares with: twice
 * `SURVEY_IMPORT_MAX_OPTIONS_PER_QUESTION`, as for a Qualtrics question's keys.
 */
export const SURVEY_IMPORT_DOCUMENT_PLAN_MAX_OPTIONS = 400;

/** Rules of one document entry, and the notes on them (one per rule). */
export const SURVEY_IMPORT_DOCUMENT_PLAN_MAX_RULES = 20;

/** A piece quotes at most a cell, which the sheet reader caps at 32,767 characters. */
export const SURVEY_IMPORT_DOCUMENT_PLAN_MAX_PIECE_CHARS = 32_767;

/** A label a document entry names: an option's code, a rule's question, value or target. */
export const SURVEY_IMPORT_DOCUMENT_PLAN_MAX_LABEL_CHARS = 200;

/**
 * Lines one document entry may span after the one it starts on: a question whose options take a line
 * each, or a list under it. Past that, a cell belongs to some other entry.
 */
export const SURVEY_IMPORT_DOCUMENT_MAX_ENTRY_LINES = 30;

/*
 * A document import's AI plan (ENG-6852, ENG-6853), sized like the Qualtrics lane's.
 */

/** One call, system prompt and instructions included. Never sent above this. */
export const SURVEY_IMPORT_DOCUMENT_MAX_CALL_CHARS = 120_000;

/**
 * All calls of one import together, system prompts, context and the retry round included: four times
 * the source budget.
 */
export const SURVEY_IMPORT_DOCUMENT_MAX_TOTAL_CHARS = 4 * SURVEY_IMPORT_AI_MAX_SOURCE_CHARS;

/**
 * Chunks one import may plan: the Qualtrics lane's ceiling (50 chunks, 152 calls, about 70,000 expected
 * output tokens), so a document costs at most what the costliest Qualtrics import does. It holds 240k
 * characters of text in lines of a few hundred characters or more; a file that needs more chunks than
 * this is past the AI ceiling like one past 240k characters, and is refused before any AI call.
 */
export const SURVEY_IMPORT_DOCUMENT_MAX_CHUNKS = 50;

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
