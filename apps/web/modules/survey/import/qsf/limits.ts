import { V3_SURVEY_MAX_LANGUAGES } from "@/app/api/v3/surveys/schemas";

/**
 * Limits of the Qualtrics reader (ENG-3654). They are checked while the file is read, so a file past
 * one is answered 422 before the stream opens and before any AI is spent.
 *
 * The route's request budget (1,000 items per array, 256 levels) already bounds the raw file; these
 * are the survey-level limits under it, sized from the largest surveys the import is built for (about
 * 150 questions) with headroom.
 */

/** Questions the survey flow may show. Trashed and unused questions do not count. */
export const QSF_MAX_QUESTIONS = 200;

/** Choices (`Choices`) and answers (`Answers`, a matrix's columns) of one question. */
export const QSF_MAX_OPTIONS_PER_QUESTION = 200;

/**
 * Languages, the default included, and embedded data fields kept as hidden fields (the rest are
 * dropped): the v3 survey document's own caps.
 */
export {
  V3_SURVEY_MAX_HIDDEN_FIELDS as QSF_MAX_HIDDEN_FIELDS,
  V3_SURVEY_MAX_LANGUAGES as QSF_MAX_LANGUAGES,
} from "@/app/api/v3/surveys/schemas";

/**
 * Raw `Language` keys of one question, and of the whole file. A real export has one per survey
 * language, so at most 50; twice that leaves room for aliases. Checked before any key is read: case
 * and whitespace variants (`DE`, ` de`, `de `) normalize to one language, so the language cap alone
 * never fires on them, and each key used to be checked against every choice and answer.
 */
export const QSF_MAX_LANGUAGE_KEYS_PER_QUESTION = 2 * V3_SURVEY_MAX_LANGUAGES;
export const QSF_MAX_LANGUAGE_KEYS = 10_000;

/**
 * Blocks in the block list, and question and page-break entries in them all together. A survey's blocks
 * hold its questions once each, and the file has at most 1,000 elements (the route's array budget).
 */
export const QSF_MAX_BLOCKS = 2_000;
export const QSF_MAX_BLOCK_ELEMENTS = 10_000;

/**
 * Embedded data fields the flow sets, all its embedded data elements together, plus the distinct names
 * texts pipe in. Far past what is kept (`QSF_MAX_HIDDEN_FIELDS`); counted as they are read, so a file
 * past it is refused before the names are collected.
 */
export const QSF_MAX_EMBEDDED_DATA_FIELDS = 10_000;

/** Nesting of the survey flow (branches, groups and randomizers inside each other). */
export const QSF_MAX_FLOW_DEPTH = 64;

/** Nodes in the survey flow, all levels together. */
export const QSF_MAX_FLOW_NODES = 2_000;

/** Condition groups, and expressions per group, read from one display, skip or branch rule. */
export const QSF_MAX_LOGIC_TERMS = 20;

/**
 * One text's size before it is sanitized. DOMPurify's cost grows with the markup it parses: about
 * 0.2 ms for a short question on jsdom, 58 ms for a 1 MB inline image and 436 ms for 20,000 spans.
 * A text past either bound is refused with a report line instead of being parsed. The tags count the
 * `<` written as character references (`&lt;`, `&#60;`, …) too: decoded, the next parse reads them as
 * tags.
 */
export const QSF_MAX_TEXT_CHARS = 50_000;
export const QSF_MAX_TEXT_TAGS = 500;

/**
 * Texts with markup (a `<` or an `&`), in all their languages together. Only these cost the sanitizer
 * a DOMPurify parse, about 0.1 ms each; a plain text only has its whitespace collapsed. 50,000 bounds an
 * import's parsing at about 5 s, sliced so the event loop keeps running, against a 120 s deadline.
 * Qualtrics keeps formatting mostly in question texts (`<b>`, `<br>`), so a survey with markup in
 * every text of 150 questions with 8 options in 40 languages (54,000) is past it.
 */
export const QSF_MAX_MARKUP_TEXTS = 50_000;

/**
 * Texts of any kind, in all their languages together: every question text, option, block name and end
 * message, once per language. Each is held in the model, copied into the draft and checked by the
 * create's schema, so the count is bounded for memory and time too. 200,000 fits the largest survey the
 * import is built for at v3's 50 languages — 200 questions of a text and 15 options is 160,000 — while
 * the per-collection limits alone admit 4 million (200 × 401 × 50).
 */
export const QSF_MAX_TEXTS = 200_000;

/** Export tags, block names and the survey name are cut to this before they are used. */
export const QSF_MAX_NAME_CHARS = 200;
