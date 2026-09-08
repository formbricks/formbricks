import { describe, expect, test } from "vitest";
import { formatImportIssueMessage } from "./messages";
import {
  addIssue,
  countIssues,
  createImportReport,
  hasFatalIssues,
  importError,
  importInfo,
  importWarning,
  summarizeDocument,
} from "./report";
import { IMPORT_ISSUE_CODES } from "./types";

describe("issue factories", () => {
  test("build a message from the code and vars, and keep sourceRef in vars", () => {
    const issue = importInfo({
      code: "unsupported_question_type",
      sourceRef: "QID4",
      vars: { type: "Timing" },
    });

    expect(issue).toEqual({
      severity: "info",
      code: "unsupported_question_type",
      message: "QID4 uses the type 'Timing', which Formbricks does not support. It was not imported.",
      sourceRef: "QID4",
      vars: { sourceRef: "QID4", type: "Timing" },
    });
  });

  test("a provided message wins over the template", () => {
    expect(importError({ code: "invalid_document", message: "custom" }).message).toBe("custom");
  });

  test("every issue code has a message template", () => {
    for (const code of IMPORT_ISSUE_CODES) {
      expect(formatImportIssueMessage(code, { detail: "d" }).length, code).toBeGreaterThan(0);
    }
  });
});

describe("report helpers", () => {
  test("createImportReport starts with an empty summary and copies issues", () => {
    const issues = [importWarning({ code: "slug_not_imported" })];
    const report = createImportReport({ lane: "lossless", kind: "formbricks-export" }, issues);

    expect(report.summary.blocks).toBe(0);
    expect(report.issues).toEqual(issues);
    expect(report.issues).not.toBe(issues);

    addIssue(report, importInfo({ code: "schedule_cleared" }));
    expect(report.issues).toHaveLength(2);
  });

  test("hasFatalIssues and countIssues read severities", () => {
    const issues = [
      importInfo({ code: "schedule_cleared" }),
      importWarning({ code: "external_url_removed" }),
      importError({ code: "unknown_element", vars: { type: "x" } }),
    ];

    expect(hasFatalIssues(issues)).toBe(true);
    expect(hasFatalIssues(issues.slice(0, 2))).toBe(false);
    expect(countIssues(issues)).toEqual({ error: 1, warning: 1, info: 1 });
  });
});

describe("summarizeDocument", () => {
  test("counts blocks, elements, endings, logic rules, languages and hidden fields", () => {
    expect(
      summarizeDocument({
        defaultLanguage: "en-US",
        languages: [{ code: "en-US" }, { code: "de-DE" }, { bogus: true }],
        blocks: [{ elements: [{}, {}], logic: [{}] }, { elements: [{}] }, "not a block"],
        endings: [{}, {}],
        hiddenFields: { enabled: true, fieldIds: ["a", "b", "c"] },
      })
    ).toEqual({
      blocks: 3,
      elements: 3,
      endings: 2,
      languages: ["en-US", "de-DE"],
      logicRules: 1,
      logicRulesReported: 0,
      hiddenFields: 3,
    });
  });

  test("tolerates anything that is not a document", () => {
    expect(summarizeDocument(null).blocks).toBe(0);
    expect(summarizeDocument("x").languages).toEqual([]);
    expect(summarizeDocument({ blocks: "nope" }).elements).toBe(0);
  });
});
