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
 *   rule in plain language, for the user to rebuild in the editor (ENG-3410)
 * - `question_skipped` — a question that could not be turned into a Formbricks question (ENG-3479)
 * - `image_dropped`, `script_dropped` — removed from a question text (ENG-3607)
 * - `formatting_dropped` — text colors and other inline styles; at most one per survey (ENG-3607)
 * - `headline_fallback` — the headline was empty after sanitizing, so the export tag stands in (ENG-3607)
 * - `field_renamed` — an embedded data name Formbricks refuses, renamed (ENG-3606)
 * - `field_dropped` — embedded data names past the most a survey can hold, left out (`params.count`)
 * - `external_url_removed` — a link the organization's plan does not allow, removed (ENG-3411)
 * - `language_skipped` — a Qualtrics language code with no Formbricks equivalent; its translations are
 *   left out (`params.code`; `params.fallback` when it was the survey's default language)
 * - `translation_fallback` — texts missing in a language, filled with the default language's text,
 *   one line per language (`params.language`, `params.count`)
 * - `piped_text_removed` — piped text with no Formbricks equivalent, removed (`params.count`)
 * - `choice_label_renamed` — duplicate labels in one question, numbered so each is distinct
 * - `choice_dropped` — a choice whose id the reader refuses
 * - `text_too_long` — a text past the size the import sanitizes, left out
 * - `markup_escaped` — plain text that would have rendered as HTML, shown as typed instead
 *
 * `question_skipped` carries `params.cause`, a fixed code (`unsupported_type` with the Qualtrics
 * `params.qualtricsType`, `ai_skipped`, `plan_invalid`, `ai_budget`, `not_in_flow`, `invalid_id`,
 * `validation_failed`); `choice_dropped` carries `invalid_id`. Params that carry text from the
 * file or the AI — `field_renamed`'s `from`, `description` on `logic_not_imported` and
 * `question_skipped`, `questionTag` — must be rendered as plain text, never as rich text.
 */
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
  | "translation_fallback"
  | "piped_text_removed"
  | "choice_label_renamed"
  | "choice_dropped"
  | "text_too_long"
  | "markup_escaped";

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
