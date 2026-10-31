import { describe, expect, test } from "vitest";
import type { TSurveyImportDraft } from "./draft";
import { buildSurveyImportReport } from "./report";

describe("buildSurveyImportReport", () => {
  test("summarizes the draft, not the file", () => {
    const document = {
      languages: [
        { code: "en-US", default: true, enabled: true },
        { code: "de-DE", default: false, enabled: true },
      ],
      blocks: [{ elements: [{}, {}] }, { elements: [{}] }],
      hiddenFields: { enabled: true, fieldIds: ["a", "b"] },
    } as unknown as TSurveyImportDraft;

    const report = buildSurveyImportReport({
      source: { kind: "qsf", fileName: "survey.qsf" },
      document,
      issues: [
        { code: "logic_not_imported", severity: "warning" },
        { code: "logic_not_imported", severity: "warning" },
        { code: "logic_imported", severity: "info" },
        { code: "formatting_dropped", severity: "info" },
      ],
    });

    expect(report.source).toEqual({ kind: "qsf", fileName: "survey.qsf" });
    expect(report.summary).toEqual({
      blocks: 2,
      questions: 3,
      languages: ["en-US", "de-DE"],
      logicRules: 2,
      importedLogicRules: 1,
      hiddenFields: 2,
    });
    expect(report.issues).toHaveLength(4);
  });

  test("leaves the import's own question ids out of the report", () => {
    const report = buildSurveyImportReport({
      source: { kind: "qsf", fileName: "survey.qsf" },
      document: {
        languages: [],
        blocks: [],
        hiddenFields: { fieldIds: [] },
      } as unknown as TSurveyImportDraft,
      issues: [{ code: "headline_fallback", severity: "warning", questionTag: "Q1", questionRef: "QID1" }],
    });

    expect(report.issues).toEqual([{ code: "headline_fallback", severity: "warning", questionTag: "Q1" }]);
  });
});
