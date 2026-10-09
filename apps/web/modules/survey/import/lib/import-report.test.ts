import { describe, expect, test } from "vitest";
import type { TQsfImportReport } from "@/modules/survey/import/types";
import {
  getQsfImportFacts,
  getQsfImportIssueLine,
  hasQsfImportWarnings,
  sortQsfImportIssues,
} from "./import-report";

const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key.split(".").pop()} ${JSON.stringify(options)}` : (key.split(".").pop() ?? key);

const report = (issues: TQsfImportReport["issues"]): TQsfImportReport => ({
  source: { kind: "qsf", fileName: "Customer survey.qsf" },
  summary: { blocks: 2, questions: 12, languages: ["en-US", "de-DE"], logicRules: 3, hiddenFields: 1 },
  issues,
});

describe("getQsfImportIssueLine", () => {
  test("fills in the AI's rule and names the Qualtrics question", () => {
    const line = getQsfImportIssueLine(
      {
        code: "logic_not_imported",
        severity: "warning",
        questionTag: "Q12",
        params: { description: 'Skip to Q7 if Q3 is "No"' },
      },
      t
    );

    expect(line).toBe('Q12: logic_not_imported {"description":"Skip to Q7 if Q3 is \\"No\\""}');
  });

  test("passes both names of a renamed field", () => {
    expect(
      getQsfImportIssueLine(
        { code: "field_renamed", severity: "info", params: { from: "Customer ID", to: "customer_id" } },
        t
      )
    ).toBe('field_renamed {"from":"Customer ID","to":"customer_id"}');
  });

  test.each([
    [
      { cause: "unsupported_type", qualtricsType: "CS" },
      'question_skipped_unsupported_type {"type":"constant_sum"}',
    ],
    [
      { cause: "unsupported_type", qualtricsType: "NewType" },
      'question_skipped_unsupported_type {"type":"NewType"}',
    ],
    [
      { cause: "ai_skipped", description: "Too many options" },
      'question_skipped_by_ai {"description":"Too many options"}',
    ],
    [{ cause: "ai_skipped" }, "question_skipped"],
    [{ cause: "ai_budget" }, "question_skipped_ai_budget"],
    [{ cause: "ai_timeout" }, "question_skipped_ai_timeout"],
    [{ cause: "draft_too_large" }, "question_skipped_draft_too_large"],
    [{ cause: "plan_invalid" }, "question_skipped_plan_invalid"],
    [{ cause: "not_in_flow" }, "question_skipped_not_in_flow"],
    [{ cause: "invalid_id" }, "question_skipped_invalid_id"],
    [{ cause: "validation_failed" }, "question_skipped_validation_failed"],
    [{ cause: "something_new" }, "question_skipped"],
  ])("says why a question was skipped: %j", (params, expected) => {
    expect(getQsfImportIssueLine({ code: "question_skipped", severity: "warning", params }, t)).toBe(
      expected
    );
  });

  test.each([
    [{ code: "de" }, 'language_skipped {"code":"de"}'],
    [
      { code: "fr", cause: "draft_too_large", order: "last_declared_first" },
      'language_skipped_too_large {"code":"fr"}',
    ],
    [
      { code: "de_DE", cause: "duplicate_language", language: "de-DE" },
      'language_skipped_duplicate {"code":"de_DE","language":"de-DE"}',
    ],
    [{ code: "xx", fallback: "en-US" }, 'language_skipped_default {"code":"xx","fallback":"en-US"}'],
    [{}, "language_skipped_unnamed"],
  ])("names the language left out: %j", (params, expected) => {
    expect(getQsfImportIssueLine({ code: "language_skipped", severity: "warning", params }, t)).toBe(
      expected
    );
  });

  test("passes the count and language of texts missing in a language", () => {
    expect(
      getQsfImportIssueLine(
        { code: "translation_missing", severity: "info", params: { language: "de-DE", count: 12 } },
        t
      )
    ).toBe('translation_missing {"count":12,"language":"de-DE"}');
  });

  test("names the end message for the default ending it added", () => {
    expect(
      getQsfImportIssueLine({ code: "ending_added", severity: "info", params: { subject: "ending" } }, t)
    ).toBe("ending: ending_added");
  });

  test("names the end message for a piped text removed from it", () => {
    expect(
      getQsfImportIssueLine(
        { code: "piped_text_removed", severity: "warning", params: { count: 2, subject: "ending" } },
        t
      )
    ).toBe('ending: piped_text_removed {"count":2}');
  });

  test("names the block for a page rule with no imported question", () => {
    expect(
      getQsfImportIssueLine(
        {
          code: "logic_not_imported",
          severity: "warning",
          params: { block: "Screening", description: "Branch to the end" },
        },
        t
      )
    ).toBe('Screening: logic_not_imported {"description":"Branch to the end"}');
  });

  test("still renders a line for a code this client does not know yet", () => {
    const unknownIssue = {
      code: "something_new",
      severity: "info",
    } as unknown as TQsfImportReport["issues"][number];

    expect(getQsfImportIssueLine(unknownIssue, t)).toBe("unknown");
  });
});

describe("every report code", () => {
  test.each([
    "image_dropped",
    "script_dropped",
    "formatting_dropped",
    "headline_fallback",
    "external_url_removed",
    "choice_label_renamed",
    "choice_dropped",
    "text_too_long",
    "markup_escaped",
    "matrix_single_answer",
  ] as const)("%s has a line of its own", (code) => {
    expect(getQsfImportIssueLine({ code, severity: "info" }, t)).toBe(code);
  });

  test.each(["field_dropped", "piped_text_removed"] as const)("%s passes its count", (code) => {
    expect(getQsfImportIssueLine({ code, severity: "warning", params: { count: 3 } }, t)).toBe(
      `${code} {"count":3}`
    );
  });

  test("names every Qualtrics type the import skips, each differently", () => {
    const types = ["CS", "SBS", "HeatMap", "HotSpot", "DD", "PGR", "Highlight", "Signature", "Draw", "GAP"];
    const lines = [...types, "Timing", "Meta", "Captcha"].map((qualtricsType) =>
      getQsfImportIssueLine(
        {
          code: "question_skipped",
          severity: "warning",
          params: { cause: "unsupported_type", qualtricsType },
        },
        t
      )
    );

    expect(new Set(lines).size).toBe(lines.length);
    for (const line of lines)
      expect(line).toMatch(/^question_skipped_unsupported_type \{"type":"[a-z_]+"\}$/);
  });
});

describe("hasQsfImportWarnings", () => {
  test("is what opens the report by itself", () => {
    expect(hasQsfImportWarnings(report([{ code: "image_dropped", severity: "warning" }]))).toBe(true);
    expect(hasQsfImportWarnings(report([{ code: "field_renamed", severity: "info" }]))).toBe(false);
  });
});

describe("getQsfImportFacts", () => {
  test("lists questions, blocks, languages, hidden fields and the logic left out", () => {
    expect(getQsfImportFacts(report([]).summary, t)).toEqual([
      'questions {"count":12}',
      'blocks {"count":2}',
      "en-US · de-DE",
      'hidden_fields {"count":1}',
      'logic_not_imported {"count":3}',
    ]);
  });

  test("leaves out hidden fields and logic when there are none", () => {
    const summary = { blocks: 1, questions: 1, languages: [], logicRules: 0, hiddenFields: 0 };

    expect(getQsfImportFacts(summary, t)).toEqual(['questions {"count":1}', 'blocks {"count":1}']);
  });
});

describe("sortQsfImportIssues", () => {
  test("puts warnings before notes, keeping the server's order inside each", () => {
    const sorted = sortQsfImportIssues([
      { code: "field_renamed", severity: "info", params: { from: "a b", to: "a_b" } },
      { code: "image_dropped", severity: "warning", questionTag: "Q2" },
      { code: "markup_escaped", severity: "info", questionTag: "Q3" },
      { code: "script_dropped", severity: "warning", questionTag: "Q4" },
    ]);

    expect(sorted.map((issue) => issue.code)).toEqual([
      "image_dropped",
      "script_dropped",
      "field_renamed",
      "markup_escaped",
    ]);
  });
});
