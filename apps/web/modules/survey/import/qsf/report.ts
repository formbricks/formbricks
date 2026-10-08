import type { TQsfImportIssue, TQsfImportReport } from "../types";
import type { TQsfDraftDocument } from "./assemble";
import type { TQsfIssue } from "./qsf-model";

/**
 * The import report (ENG-3654). The summary is read off the assembled document, so it describes the
 * draft the user reviews, not the file. Never stored and never logged: the route logs counts only.
 */
export function buildQsfImportReport(params: {
  fileName: string;
  document: TQsfDraftDocument;
  issues: TQsfIssue[];
}): TQsfImportReport {
  const { fileName, document, issues } = params;
  return {
    source: { kind: "qsf", fileName },
    summary: {
      blocks: document.blocks.length,
      questions: document.blocks.reduce((count, block) => count + block.elements.length, 0),
      languages: document.languages.map((language) => language.code),
      logicRules: issues.filter((issue) => issue.code === "logic_not_imported").length,
      hiddenFields: document.hiddenFields.fieldIds.length,
    },
    // The question ids are the import's own bookkeeping, not part of the report.
    issues: issues.map(({ questionRef: _questionRef, ...issue }): TQsfImportIssue => issue),
  };
}
