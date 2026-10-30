/**
 * The survey import's contract between the server and the import dialog, shared by every lane (one per
 * kind of file). Type-only on purpose, so the dialog (a client component) can import it without
 * pulling in server code.
 */

/**
 * The kind of file an import read, one per lane: `qsf` is a Qualtrics export, `formbricks` a Formbricks
 * file, `xlsx` and `csv` a question list read as a document (ENG-6852). The report's `source` names it,
 * so the dialog can say what was read.
 */
export type TSurveyImportSourceKind = "qsf" | "formbricks" | "xlsx" | "csv";

/**
 * What the import is doing, sent as a `progress` event. The dialog maps each to a line in its progress
 * steps; the server repeats the current one as a heartbeat while a stage runs long. A lane that uses no
 * AI goes from `reading` to `assembling`.
 */
export type TSurveyImportStage = "reading" | "ai" | "assembling";

/**
 * Report lines an import can produce, one code per thing a user may have to act on. The dialog
 * renders and translates them by code, so the server never sends user-facing English. The Qualtrics
 * lane writes every code below today; the ones that name Qualtrics are its own.
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
 * - `ending_not_translated` — languages whose ending shows a stand-in, because the file has no
 *   translation of it: Formbricks' own thank-you, else the default language's text (`params.languages`,
 *   `params.subject: "ending"`). Qualtrics exports never hold the end message's translations
 * - `ending_added` — the file had no end message the survey can show, so the editor's default ending was
 *   added (`params.subject: "ending"`)
 *
 *
 * The Formbricks file lane's (ENG-6850):
 *
 * - `unknown_key_dropped` — a key the file format does not know, left out (`params.field`, its path in
 *   the file); past the first fifty, one line counts the rest (`params.count`)
 * - `custom_css_removed` — the survey's custom CSS, which an import never carries over
 * - `external_url_removed` — as above, for an ending's redirect (replaced by the default ending), its
 *   button link, or a call-to-action's external button
 * - `targeting_removed` — the survey's targeting, because the organization's plan has no contact
 *   targeting
 * - `targeting_filter_removed` — a targeting filter naming a segment or a survey, which belong to the
 *   workspace the file came from
 * - `action_class_created`, `attribute_key_created` — a trigger's action, or an attribute key targeting
 *   names, the workspace did not have and the import creates (`params.name`, `params.key`)
 * - `content_only` — the note that styling, settings, follow-ups and quotas are not part of the file
 *
 * A document import's (ENG-6852):
 *
 * - `logic_imported` — one per rule the import turned into survey logic, for the user to check;
 *   `params.description` is the AI's note on the rule, plain text, when it gave one
 * - `logic_not_imported` — as above, for a routing rule the import could not turn into logic: it names a
 *   question or an answer the draft does not have, or one Formbricks logic cannot test
 * - `text_not_split` — a cell whose question and options could not be told apart word for word, imported
 *   whole as the question's text (`params.cell`)
 * - `sheets_skipped` — the workbook's other sheets, which an import never reads (`params.sheets`)
 * - `file_encoding` — how a text file was decoded (`params.encoding`: `utf-8`, `utf-16le`, `utf-16be`
 *   or `windows-1252`)
 *
 * An Update's own (ENG-6851), in `TSurveyImportMatch.issues`, for a matched survey that has responses:
 *
 * - `question_removed` — a question the survey has and the file does not; its answers stop showing in
 *   the summary (`questionTag` is its id, `params.headline` its default-language text)
 * - `option_removed` — an option, matrix row or column a question keeps but the file does not
 *   (`questionTag` is the question's id, `params.option` the option's default-language label)
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
 * The kinds of file the import tells apart by their content (ENG-6848), never by the name or the
 * `Content-Type` the browser sent: `formbricks` is a Formbricks file, `qsf` a Qualtrics export, the rest
 * a document to import. Each kind is read by its lane once it has one.
 */
export type TSurveyImportFileType = "formbricks" | "qsf" | "docx" | "xlsx" | "csv";

/**
 * The codes on the invalid params of an import's refusal, from v3's `InvalidParam.code`, so the dialog
 * can tell the refusals apart without reading the reason. Every lane's, about the uploaded file (`name`
 * is `file`, or a path inside it):
 *
 * - `file_type_unsupported` (415) — the import does not read this kind of file. `identifier` names
 *   what it is when the import recognized it: `legacy_office` for a `.doc` or `.xls`, which the reason
 *   asks to save as `.docx` or `.xlsx`, or a `TSurveyImportFileType` whose lane is not built yet;
 * - `file_limit_exceeded` — the file is past one of the upload's limits, named in `identifier`
 *   (`TSurveyImportFileLimit`): 413 for a size, 422 for the JSON budget;
 * - `file_unreadable` (422) — the file is the kind it looks like, but broken: an empty file, a damaged
 *   or encrypted archive, JSON that does not parse.
 *
 * A document import's (422, ENG-6852):
 *
 * - `document_limit_exceeded` — the sheet or CSV is past one of the import's limits, named in the
 *   param's `identifier` (`TSurveyImportDocumentLimit`). `source_size` is the AI ceiling: such a file
 *   is imported through MCP instead.
 *
 * The Qualtrics lane's (422):
 *
 * - `qsf_not_recognized` — the file is not a Qualtrics export the import can read: the envelope is
 *   missing, it has two survey flows, block lists or option sets, two questions share an id, or no
 *   question is in its flow;
 * - `qsf_limit_exceeded` — the file is a Qualtrics export past one of the import's limits, named in
 *   the param's `identifier` (`TSurveyImportLimit`); `name` points at where in the file.
 */
export type TSurveyImportRefusalCode =
  | "file_type_unsupported"
  | "file_limit_exceeded"
  | "file_unreadable"
  | "qsf_not_recognized"
  | "qsf_limit_exceeded"
  | "document_limit_exceeded";

/**
 * The problem codes of an import's 422s that are not about the upload itself: a Formbricks file that is
 * malformed — its `invalid_params` name each field — or written by a newer Formbricks than this one.
 */
export type TSurveyImportProblemCode = "formbricks_file_invalid" | "formbricks_file_too_new";

/** What a `file_type_unsupported` param names in its `identifier`, when the import recognized the file. */
export type TSurveyImportUnsupportedFile = TSurveyImportFileType | "legacy_office";

/**
 * The upload limit a `file_limit_exceeded` param is about, in its `identifier`. Each is a constant in
 * `limits.ts` or the v3 array budget:
 *
 * - `file_size` — the file's bytes (413);
 * - `zip_entries`, `zip_inflated_size`, `zip_part_size`, `zip_compression_ratio` — a `.docx` or `.xlsx`
 *   archive's entries, its inflated bytes in total and per part, and one entry's compression ratio (413);
 * - `array_items`, `array_elements`, `nesting_depth` — a JSON file's longest array, its array elements
 *   in total, and its nesting (422);
 * - `survey_size` — a Formbricks file's survey, as JSON, past what one survey may weigh (413).
 */
export type TSurveyImportFileLimit =
  | "file_size"
  | "zip_entries"
  | "zip_inflated_size"
  | "zip_part_size"
  | "zip_compression_ratio"
  | "array_items"
  | "array_elements"
  | "nesting_depth"
  | "survey_size";

/**
 * The limit a `document_limit_exceeded` param is about, in its `identifier`: the sheet's or CSV's rows,
 * columns and characters in one cell, and the text the AI would read, all cells together.
 */
export type TSurveyImportDocumentLimit = "rows" | "columns" | "cell_size" | "source_size";

/** The limit a `qsf_limit_exceeded` param is about, in its `identifier`. */
export type TSurveyImportLimit =
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

export type TSurveyImportIssueCode =
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
  | "ending_not_translated"
  | "options_left_out"
  | "scale_changed"
  | "ending_added"
  | "unknown_key_dropped"
  | "custom_css_removed"
  | "targeting_removed"
  | "targeting_filter_removed"
  | "action_class_created"
  | "attribute_key_created"
  | "content_only"
  | "logic_imported"
  | "text_not_split"
  | "sheets_skipped"
  | "file_encoding"
  | "question_removed"
  | "option_removed";

export interface TSurveyImportIssue {
  code: TSurveyImportIssueCode;
  /** `warning` when something the user had is missing or changed; `info` for expected differences. */
  severity: "warning" | "info";
  /**
   * The source question the line is about, by the label the file gives it (a Qualtrics export tag,
   * e.g. `Q12`), when there is one.
   */
  questionTag?: string;
  /**
   * Values the dialog interpolates into the translated line, e.g.
   * `{ from: "Customer ID", to: "customer_id" }`.
   */
  params?: Record<string, string | number>;
}

export interface TSurveyImportReport {
  source: { kind: TSurveyImportSourceKind; fileName: string };
  summary: {
    blocks: number;
    questions: number;
    /** BCP-47 codes, default language first. */
    languages: string[];
    /** Logic rules the file has and the import could not bring over. */
    logicRules: number;
    /** Logic rules the import turned into survey logic, each listed in the report for checking. */
    importedLogicRules: number;
    hiddenFields: number;
  };
  issues: TSurveyImportIssue[];
}

/**
 * How an Update treats the survey's triggers (ENG-6851): replace them with the file's, or keep the
 * survey's own. `keep` sends no `distribution`, so the display settings stay as they are too.
 */
export type TSurveyImportTriggersChoice = "file" | "keep";

/**
 * What the review offers about the survey's triggers on an Update:
 *
 * - `same` — the file's triggers, resolved in this workspace, are the survey's: no choice to make;
 * - `differ` — they differ, and the user picks the file's or the current ones;
 * - `keep_only` — they differ, but the file's would leave a live app survey with no trigger and no
 *   creative to show it, which the publish rule forbids: only the current ones can be kept.
 */
export type TSurveyImportTriggersState = "same" | "differ" | "keep_only";

/**
 * A Match (ENG-6851): the survey a Formbricks file was exported from, found in the workspace the file is
 * imported into, and one the importing user can edit. Anything else — another workspace, a survey the
 * user cannot edit, an archived or deleted one — is no match, with nothing said about why, so an import
 * never tells a user a survey exists.
 */
export interface TSurveyImportMatch {
  surveyId: string;
  name: string;
  /** `inProgress` locks the choice on Create new: an active survey is never updated. */
  status: "draft" | "inProgress" | "paused" | "completed";
  /**
   * When the survey last changed, read during this review. "Update anyway" sends it, so a survey that
   * changes again after the review, going live included, is still refused.
   */
  updatedAt: string;
  /** When the survey last changed before the export, from the file: what an Update sends first. */
  exportedUpdatedAt: string;
  triggers: TSurveyImportTriggersState;
  /** The report lines only an Update adds: what it removes from a survey that has responses. */
  issues: TSurveyImportIssue[];
}
