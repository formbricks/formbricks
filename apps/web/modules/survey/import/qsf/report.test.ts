import { describe, expect, test } from "vitest";
import type { TQsfDraftDocument } from "./assemble";
import { buildQsfImportReport } from "./report";

describe("buildQsfImportReport", () => {
  test("summarizes the draft, not the file", () => {
    const document = {
      languages: [
        { code: "en-US", default: true, enabled: true },
        { code: "de-DE", default: false, enabled: true },
      ],
      blocks: [{ elements: [{}, {}] }, { elements: [{}] }],
      hiddenFields: { enabled: true, fieldIds: ["a", "b"] },
    } as unknown as TQsfDraftDocument;

    const report = buildQsfImportReport({
      fileName: "survey.qsf",
      document,
      issues: [
        { code: "logic_not_imported", severity: "warning" },
        { code: "logic_not_imported", severity: "warning" },
        { code: "formatting_dropped", severity: "info" },
      ],
    });

    expect(report.source).toEqual({ kind: "qsf", fileName: "survey.qsf" });
    expect(report.summary).toEqual({
      blocks: 2,
      questions: 3,
      languages: ["en-US", "de-DE"],
      logicRules: 2,
      hiddenFields: 2,
    });
    expect(report.issues).toHaveLength(3);
  });

  test("leaves the import's own question ids out of the report", () => {
    const report = buildQsfImportReport({
      fileName: "survey.qsf",
      document: { languages: [], blocks: [], hiddenFields: { fieldIds: [] } } as unknown as TQsfDraftDocument,
      issues: [{ code: "headline_fallback", severity: "warning", questionTag: "Q1", questionRef: "QID1" }],
    });

    expect(report.issues).toEqual([{ code: "headline_fallback", severity: "warning", questionTag: "Q1" }]);
  });
});
