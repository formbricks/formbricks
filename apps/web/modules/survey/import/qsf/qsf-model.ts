import type { TSurveyImportPipelineIssue } from "../core/report";
import type { TSurveyImportText } from "../core/sanitize-text";

/**
 * What the reader recovers from a Qualtrics export (ENG-3654): only what the import uses, in shapes
 * that cannot be polluted. Every keyed collection is a `Map`; ids and language codes went through a
 * bounded pattern before they became a key; texts are held by a key the reader assigned, never by an
 * id from the file.
 *
 * Texts are kept as Qualtrics stores them (HTML) until the sanitizer runs, which happens in
 * `runQsfImport` because it is the costly step and yields to the event loop.
 */

/**
 * A text key: `t{n}` for a question text, `c{n}` for a choice (`Choices`), `a{n}` for an answer
 * (`Answers`, a matrix's columns), `b{n}` for a block name, `s{n}` for a survey-level text. The AI
 * plan refers to choices by these keys, and the assembly copies texts by them, so the AI never writes
 * survey text.
 */
export type TQsfTextKey = string;

export interface TQsfOption {
  key: TQsfTextKey;
  /** `TextEntry`: the "Other, please specify" pattern. */
  textEntry: boolean;
  /** `ExclusiveAnswer`: a "None of the above" that clears the other choices. */
  exclusive: boolean;
}

/** One condition of a display, skip or branch rule, compacted for the prompt: no HTML, no descriptions. */
export interface TQsfLogicCondition {
  /** The question the condition reads, when it reads one. */
  questionRef?: string;
  /** The choice of that question, as a text key. */
  choiceKey?: TQsfTextKey;
  /** An embedded data field the condition reads. */
  field?: string;
  operator: string;
  value?: string;
  /** How this condition joins the one before it. */
  conjunction?: "and" | "or";
}

export interface TQsfLogicRule {
  kind: "display" | "skip" | "branch" | "randomizer";
  conditions: TQsfLogicCondition[];
  /** Skip rules: where the respondent goes — `end_of_survey`, `end_of_block` or a question ref. */
  destination?: string;
}

export interface TQsfSlider {
  min: number | null;
  max: number | null;
  gridLines: number | null;
  stars: number | null;
}

export interface TQsfQuestion {
  /** The `QID`, checked against the reader's `QID<number>` pattern. */
  ref: string;
  /**
   * `DataExportTag`, cut to `SURVEY_IMPORT_MAX_NAME_CHARS`. File text: used for element ids and report
   * lines.
   */
  exportTag: string;
  /** Global position in flow order, which the assembly keeps. */
  position: number;
  pageId: string;
  qualtricsType: string;
  selector: string | null;
  subSelector: string | null;
  textKey: TQsfTextKey;
  choices: TQsfOption[];
  answers: TQsfOption[];
  forceResponse: "ON" | "OFF" | "REQUEST" | null;
  contentType: string | null;
  /** `ValidDateType` of a date-validated text entry, e.g. `DateWithFormat`. */
  dateFormat: string | null;
  slider: TQsfSlider | null;
  randomized: boolean;
  logic: TQsfLogicRule[];
}

export interface TQsfPage {
  id: string;
  /** The Qualtrics block the page belongs to; a block with page breaks has several pages. */
  blockId: string;
  blockNameKey: TQsfTextKey;
  questionRefs: string[];
  /** Branch and randomizer rules that gate this page. */
  logic: TQsfLogicRule[];
}

export interface TQsfSurvey {
  name: string;
  /** Normalized, region-qualified BCP-47 code. */
  defaultLanguage: string;
  /**
   * The other languages any question is translated into, normalized, in the order the file first
   * declares them (its first question's `Language` keys, then each new one as it appears).
   */
  languages: string[];
  /** Questions in flow order. */
  questions: Map<string, TQsfQuestion>;
  pages: TQsfPage[];
  texts: Map<TQsfTextKey, TSurveyImportText>;
  /** Embedded data names from the flow and from `${e://Field/…}` references, first seen first. */
  embeddedDataNames: string[];
  endMessageKey: TQsfTextKey | null;
  endRedirectUrl: string | null;
  /** Lines the reader already knows belong in the report (refused ids, skipped languages, …). */
  issues: TSurveyImportPipelineIssue[];
}
