/**
 * The Qualtrics import's contract between the server and the import dialog. Type-only on purpose, so
 * the dialog (a client component) can import it without pulling in server code.
 */

/**
 * What the import is doing, sent as a `progress` event. The dialog maps each to a line in its progress
 * steps; the server repeats the current one as a heartbeat while a stage runs long.
 */
export type TQsfImportStage = "reading" | "ai" | "assembling";

/**
 * Report lines the import can produce, one code per thing a user may have to act on. The dialog
 * renders and translates them by code, so the server never sends user-facing English.
 *
 * - `logic_not_imported` — one per Qualtrics skip, display or branch rule; `params.description` is the
 *   rule in plain language, for the user to rebuild in the editor (ENG-3410). A rule of a page none
 *   of whose questions was imported has no `questionTag`; `params.block` names its block instead
 * - `question_skipped` — a question that could not be turned into a Formbricks question (ENG-3479)
 * - `image_dropped`, `script_dropped` — removed from a question text (ENG-3607), or from the end
 *   message, with no `questionTag` and `params.subject: "ending"`
 * - `formatting_dropped` — text colors and other inline styles; at most one per survey (ENG-3607)
 * - `headline_fallback` — the headline was empty after sanitizing, so the export tag stands in (ENG-3607)
 * - `field_renamed` — an embedded data name Formbricks refuses, renamed (ENG-3606)
 * - `field_dropped` — embedded data names past the most a survey can hold, left out (`params.count`)
 * - `external_url_removed` — a link the organization's plan does not allow, removed (ENG-3411)
 * - `language_skipped` — a Qualtrics language code with no Formbricks equivalent; its translations are
 *   left out (`params.code`; `params.fallback` when it was the survey's default language). With
 *   `params.cause: "draft_too_large"`, a language the import cut because the draft was too large to
 *   create, with `params.order: "last_declared_first"`: languages go in reverse of the order the
 *   file declares them. With `params.cause: "duplicate_language"`, a code that normalizes to the same
 *   language (`params.language`) as a code the file gave earlier, the default's included; the first
 *   keeps the language and this one's translations are left out
 * - `translation_missing` — texts missing in a language, left empty; the language is imported turned
 *   off, to be completed in the editor. One line per language (`params.language`, `params.count`)
 * - `piped_text_removed` — piped text with no Formbricks equivalent, removed, or a recall of a
 *   question the import cut, shown as its fallback text (`params.count`). Under the question holding
 *   it, or, for the end message, with no `questionTag` and `params.subject: "ending"`
 * - `choice_label_renamed` — duplicate labels in one question, numbered so each is distinct
 * - `choice_dropped` — a choice whose id the reader refuses
 * - `text_too_long` — a text past the size the import sanitizes, left out
 * - `markup_escaped` — plain text that would have rendered as HTML, shown as typed instead
 * - `matrix_single_answer` — a Qualtrics matrix that takes several answers per row, imported as a
 *   Formbricks matrix, which takes one
 * - `options_left_out` — options the AI left out of a list the element shows (`params.count`, and
 *   `params.options`, their names from the file)
 * - `scale_changed` — a slider whose number of points a rating does not have, imported at the
 *   nearest size it does (`params.from`, `params.to`)
 * - `ending_added` — the file had no end message the survey can show, so the editor's default ending was
 *   added (`params.subject: "ending"`)
 *
 * `question_skipped` carries `params.cause`, a fixed code (`unsupported_type` with the Qualtrics
 * `params.qualtricsType`, `ai_skipped`, `plan_invalid`, `ai_budget`, `ai_timeout`, `not_in_flow`,
 * `invalid_id`, `validation_failed`, `draft_too_large` for a trailing question cut so the draft fits
 * the create's size limit); `choice_dropped` carries `invalid_id`. Params that carry text from the
 * file or the AI — `field_renamed`'s `from`, `description` on `logic_not_imported` and
 * `question_skipped`, `logic_not_imported`'s `block`, `options_left_out`'s `options`, `questionTag` — must
 * be rendered as plain text,
 * never as rich text.
 */
/**
 * The codes on the invalid params of the import's 422 (`QsfImportInputError`), from v3's
 * `InvalidParam.code`, so the dialog can tell the two refusals apart without reading the reason:
 *
 * - `qsf_not_recognized` — the file is not a Qualtrics export the import can read: the envelope is
 *   missing, it has two survey flows, block lists or option sets, two questions share an id, or no
 *   question is in its flow;
 * - `qsf_limit_exceeded` — the file is a Qualtrics export past one of the import's limits, named in
 *   the param's `identifier` (`TQsfImportLimit`); `name` points at where in the file.
 */
export type TQsfImportRefusalCode = "qsf_not_recognized" | "qsf_limit_exceeded";

/** The limit a `qsf_limit_exceeded` param is about, in its `identifier`. */
export type TQsfImportLimit =
  | "questions"
  | "options"
  | "languages"
  | "language_keys"
  | "blocks"
  | "block_entries"
  | "flow_nodes"
  | "flow_depth"
  | "embedded_data"
  | "texts"
  | "formatted_texts"
  | "prompt_size";

export type TQsfImportIssueCode =
  | "logic_not_imported"
  | "question_skipped"
  | "image_dropped"
  | "script_dropped"
  | "formatting_dropped"
  | "headline_fallback"
  | "field_renamed"
  | "field_dropped"
  | "external_url_removed"
  | "language_skipped"
  | "translation_missing"
  | "piped_text_removed"
  | "choice_label_renamed"
  | "choice_dropped"
  | "text_too_long"
  | "markup_escaped"
  | "matrix_single_answer"
  | "options_left_out"
  | "scale_changed"
  | "ending_added";

export interface TQsfImportIssue {
  code: TQsfImportIssueCode;
  /** `warning` when something the user had is missing or changed; `info` for expected differences. */
  severity: "warning" | "info";
  /** The Qualtrics question the line is about (its export tag, e.g. `Q12`), when there is one. */
  questionTag?: string;
  /**
   * Values the dialog interpolates into the translated line, e.g.
   * `{ from: "Customer ID", to: "customer_id" }`.
   */
  params?: Record<string, string | number>;
}

export interface TQsfImportReport {
  source: { kind: "qsf"; fileName: string };
  summary: {
    blocks: number;
    questions: number;
    /** BCP-47 codes, default language first. */
    languages: string[];
    logicRules: number;
    hiddenFields: number;
  };
  issues: TQsfImportIssue[];
}
