import { V3_SURVEY_MAX_HIDDEN_FIELDS, V3_SURVEY_MAX_LANGUAGES } from "@/app/api/v3/surveys/schemas";

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

/** Languages, the default included: the v3 survey document's own cap. */
export const QSF_MAX_LANGUAGES = V3_SURVEY_MAX_LANGUAGES;

/** Embedded data fields, which become hidden fields: the v3 survey document's own cap. */
export const QSF_MAX_HIDDEN_FIELDS = V3_SURVEY_MAX_HIDDEN_FIELDS;

/** Nesting of the survey flow (branches, groups and randomizers inside each other). */
export const QSF_MAX_FLOW_DEPTH = 64;

/** Nodes in the survey flow, all levels together. */
export const QSF_MAX_FLOW_NODES = 2_000;

/** Condition groups, and expressions per group, read from one display, skip or branch rule. */
export const QSF_MAX_LOGIC_TERMS = 20;

/**
 * One text's size before it is sanitized. DOMPurify's cost grows with the markup it parses: about
 * 0.2 ms for a short question on jsdom, 58 ms for a 1 MB inline image and 436 ms for 20,000 spans.
 * A text past either bound is refused with a report line instead of being parsed.
 */
export const QSF_MAX_TEXT_CHARS = 50_000;
export const QSF_MAX_TEXT_TAGS = 500;

/** Export tags, block names and the survey name are cut to this before they are used. */
export const QSF_MAX_NAME_CHARS = 200;
