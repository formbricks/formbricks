import type { TSurveyImportIssue, TSurveyImportReport } from "../types";

/** What the report's summary reads off a draft: an assembled one, or one a lane copied from its file. */
export interface TSurveyImportReportDocument {
  blocks: ReadonlyArray<{ elements: ReadonlyArray<unknown> }>;
  /** Default language first. */
  languages: ReadonlyArray<{ code: string }>;
  hiddenFields: { fieldIds: ReadonlyArray<string> };
}

/**
 * A report line inside the import, with the source question (`questionRef`, the lane's own id for it)
 * it is about. The id is how the import finds the lines of a question it cuts, since the labels a file
 * gives its questions can repeat; `buildSurveyImportReport` leaves it out of the report the dialog
 * gets.
 */
export interface TSurveyImportPipelineIssue extends TSurveyImportIssue {
  questionRef?: string;
}

/** The most option names one `options_left_out` line reads, and the most characters each may take. */
const REPORTED_OPTION_NAMES = 5;
const REPORTED_OPTION_NAME_CHARS = 40;

/**
 * Option names for an `options_left_out` line: the first few, each cut, and an ellipsis when more were
 * left out than the line names.
 */
export const joinOptionNames = (names: readonly string[]): string => {
  const named = names
    .slice(0, REPORTED_OPTION_NAMES)
    .map((name) =>
      name.length > REPORTED_OPTION_NAME_CHARS ? `${name.slice(0, REPORTED_OPTION_NAME_CHARS - 1)}…` : name
    );
  return names.length > REPORTED_OPTION_NAMES ? `${named.join(", ")}, …` : named.join(", ");
};

/**
 * The import report (ENG-3654). The summary is read off the assembled draft, so it describes the draft
 * the user reviews, not the file. Never stored and never logged: the route logs counts only.
 */
export function buildSurveyImportReport(params: {
  source: TSurveyImportReport["source"];
  document: TSurveyImportReportDocument;
  issues: TSurveyImportPipelineIssue[];
}): TSurveyImportReport {
  const { source, document, issues } = params;
  return {
    source,
    summary: {
      blocks: document.blocks.length,
      questions: document.blocks.reduce((count, block) => count + block.elements.length, 0),
      languages: document.languages.map((language) => language.code),
      logicRules: issues.filter((issue) => issue.code === "logic_not_imported").length,
      importedLogicRules: issues.filter((issue) => issue.code === "logic_imported").length,
      hiddenFields: document.hiddenFields.fieldIds.length,
    },
    // The question ids are the import's own bookkeeping, not part of the report.
    issues: issues.map(({ questionRef: _questionRef, ...issue }): TSurveyImportIssue => issue),
  };
}
