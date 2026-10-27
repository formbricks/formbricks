import { describe, expect, test } from "vitest";
import {
  ANSWER_CODE_MAX_LENGTH,
  EXPORT_COLUMN_NAMES,
  QUESTION_CODE_MAX_LENGTH,
  SPSS_RESERVED_WORDS,
  validateAnswerCodeFormat,
  validateQuestionCodeFormat,
  validateSurveyCodes,
} from "./codes";

describe("validateQuestionCodeFormat", () => {
  test.each(["q1", "q", "adm01", "age_group", "a1_b2_c3", "a".repeat(QUESTION_CODE_MAX_LENGTH)])(
    "accepts %s",
    (code) => {
      expect(validateQuestionCodeFormat(code)).toBeNull();
    }
  );

  test.each([
    ["", "empty"],
    ["1q", "must_start_with_lowercase_letter"],
    ["_q", "must_start_with_lowercase_letter"],
    ["Q1", "must_start_with_lowercase_letter"],
    ["qA", "invalid_characters"],
    ["q-1", "invalid_characters"],
    ["q 1", "invalid_characters"],
    ["q.1", "invalid_characters"],
    ["q__1", "double_underscore"],
    ["q1_", "trailing_underscore"],
    ["a".repeat(QUESTION_CODE_MAX_LENGTH + 1), "too_long"],
  ])("rejects %j as %s", (code, reason) => {
    expect(validateQuestionCodeFormat(code)).toBe(reason);
  });

  test("rejects every SPSS reserved word, in any spelling that survives the charset rule", () => {
    expect(SPSS_RESERVED_WORDS).toEqual([
      "all",
      "and",
      "by",
      "eq",
      "ge",
      "gt",
      "le",
      "lt",
      "ne",
      "not",
      "or",
      "to",
      "with",
    ]);
    for (const word of SPSS_RESERVED_WORDS) {
      expect(validateQuestionCodeFormat(word)).toBe("spss_reserved_word");
    }
  });

  test("accepts a code that merely contains a reserved word", () => {
    expect(validateQuestionCodeFormat("all_in")).toBeNull();
    expect(validateQuestionCodeFormat("to1")).toBeNull();
  });

  test("rejects every export column name", () => {
    expect(EXPORT_COLUMN_NAMES).toEqual(expect.arrayContaining(["response_id", "language", "outcome"]));
    for (const name of EXPORT_COLUMN_NAMES) {
      expect(validateQuestionCodeFormat(name)).toBe("export_column_name");
    }
  });
});

describe("validateAnswerCodeFormat", () => {
  test.each(["1", "98", "a", "other", "a_b", "0", "1a", "a".repeat(ANSWER_CODE_MAX_LENGTH)])(
    "accepts %s",
    (code) => {
      expect(validateAnswerCodeFormat(code)).toBeNull();
    }
  );

  test.each([
    ["", "empty"],
    ["A", "invalid_characters"],
    ["a-b", "invalid_characters"],
    ["_a", "must_start_with_letter_or_digit"],
    ["a__b", "double_underscore"],
    ["a_", "trailing_underscore"],
    ["a".repeat(ANSWER_CODE_MAX_LENGTH + 1), "too_long"],
    ["and", "spss_reserved_word"],
    ["response_id", "export_column_name"],
  ])("rejects %j as %s", (code, reason) => {
    expect(validateAnswerCodeFormat(code)).toBe(reason);
  });

  test("a question code may not be 21 characters as an answer code", () => {
    expect(validateQuestionCodeFormat("a".repeat(21))).toBeNull();
    expect(validateAnswerCodeFormat("a".repeat(21))).toBe("too_long");
  });
});

const element = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: "openText",
  headline: { default: id },
  required: false,
  ...extra,
});
const block = (...elements: Record<string, unknown>[]) => ({ id: `b-${String(elements[0]?.id)}`, elements });
const choice = (id: string, code?: string) => ({ id, label: { default: id }, ...(code ? { code } : {}) });

describe("validateSurveyCodes", () => {
  test("a survey without any codes has no issues (codes are optional)", () => {
    expect(validateSurveyCodes({ blocks: [block(element("a"), element("b"))] })).toEqual([]);
  });

  test("a well-formed, unique survey has no issues", () => {
    const blocks = [
      block(
        element("a", { code: "q1" }),
        element("b", {
          type: "multipleChoiceSingle",
          code: "q2",
          choices: [choice("c1", "1"), choice("c2", "2")],
        })
      ),
      block(
        element("m", {
          type: "matrix",
          code: "q3",
          rows: [choice("r1", "1"), choice("r2", "2")],
          columns: [choice("k1", "1"), choice("k2", "2")],
        })
      ),
    ];
    expect(validateSurveyCodes({ blocks, embeddedDataNames: ["country_x"] })).toEqual([]);
  });

  test("reports a malformed question code at its path with the reason", () => {
    const issues = validateSurveyCodes({ blocks: [block(element("a"), element("b", { code: "Q1" }))] });
    expect(issues).toEqual([
      expect.objectContaining({
        kind: "invalid_format",
        reason: "must_start_with_lowercase_letter",
        path: ["blocks", 0, "elements", 1, "code"],
        value: "Q1",
      }),
    ]);
    expect(issues[0].message).toContain("Q1");
  });

  test("reports reserved words as their own kind of format issue", () => {
    const issues = validateSurveyCodes({ blocks: [block(element("a", { code: "and" }))] });
    expect(issues).toEqual([
      expect.objectContaining({ kind: "invalid_format", reason: "spss_reserved_word" }),
    ]);
  });

  test("two questions with one code: the later one is reported and names the first", () => {
    const issues = validateSurveyCodes({
      blocks: [block(element("a", { code: "q1" })), block(element("b", { code: "q1" }))],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      kind: "duplicate_question_code",
      path: ["blocks", 1, "elements", 0, "code"],
      clashesWith: "a",
    });
    expect(issues[0].message).toBe('Question code "q1" is already used by question "a".');
  });

  test("a code equal to an Embedded Data name is refused, ignoring case", () => {
    const issues = validateSurveyCodes({
      blocks: [block(element("a", { code: "plan" }))],
      embeddedDataNames: ["Plan"],
    });
    expect(issues).toEqual([
      expect.objectContaining({
        kind: "clashes_embedded_data",
        path: ["blocks", 0, "elements", 0, "code"],
        clashesWith: "Plan",
        message: 'Question code "plan" is already used by the Embedded Data field "Plan".',
      }),
    ]);
  });

  test("a code equal to ANOTHER question's Question ID is refused, ignoring case", () => {
    const issues = validateSurveyCodes({
      blocks: [block(element("a", { code: "q2" }), element("Q2"))],
    });
    expect(issues).toEqual([
      expect.objectContaining({
        kind: "clashes_question_id",
        clashesWith: "Q2",
        message: 'Question code "q2" is already used by the Question ID of question "Q2".',
      }),
    ]);
  });

  test("a question's own Question ID may be its code", () => {
    expect(validateSurveyCodes({ blocks: [block(element("q1", { code: "q1" }))] })).toEqual([]);
    expect(validateSurveyCodes({ blocks: [block(element("Q1", { code: "q1" }))] })).toEqual([]);
  });

  test("CTA elements carry no code: a stray one is not validated or counted", () => {
    const blocks = [block(element("a", { code: "q1" }), element("c", { type: "cta", code: "q1" }))];
    expect(validateSurveyCodes({ blocks })).toEqual([]);
  });

  test("answer codes must be unique within their question", () => {
    const issues = validateSurveyCodes({
      blocks: [
        block(element("a", { type: "multipleChoiceMulti", choices: [choice("c1", "1"), choice("c2", "1")] })),
      ],
    });
    expect(issues).toEqual([
      expect.objectContaining({
        kind: "duplicate_answer_code",
        path: ["blocks", 0, "elements", 0, "choices", 1, "code"],
        clashesWith: "c1",
        message: 'Answer code "1" is already used by option "c1" of question "a".',
      }),
    ]);
  });

  test("the same answer code in two different questions is fine", () => {
    const blocks = [
      block(
        element("a", { type: "multipleChoiceSingle", choices: [choice("c1", "1"), choice("c2", "2")] }),
        element("b", { type: "ranking", choices: [choice("d1", "1"), choice("d2", "2")] })
      ),
    ];
    expect(validateSurveyCodes({ blocks })).toEqual([]);
  });

  test("matrix rows and columns are checked separately", () => {
    const ok = element("m", {
      type: "matrix",
      rows: [choice("r1", "1"), choice("r2", "2")],
      columns: [choice("k1", "1"), choice("k2", "2")],
    });
    expect(validateSurveyCodes({ blocks: [block(ok)] })).toEqual([]);

    const bad = element("m", {
      type: "matrix",
      rows: [choice("r1", "1"), choice("r2", "1")],
      columns: [choice("k1", "1"), choice("k2", "1")],
    });
    const issues = validateSurveyCodes({ blocks: [block(bad)] });
    expect(issues.map((issue) => issue.path.join("."))).toEqual([
      "blocks.0.elements.0.rows.1.code",
      "blocks.0.elements.0.columns.1.code",
    ]);
    expect(issues[0].message).toBe('Answer code "1" is already used by row "r1" of question "m".');
    expect(issues[1].message).toBe('Answer code "1" is already used by column "k1" of question "m".');
  });

  test("picture choices are coded like any other option", () => {
    const issues = validateSurveyCodes({
      blocks: [
        block(
          element("p", {
            type: "pictureSelection",
            choices: [
              { id: "x", imageUrl: "u", code: "Bad" },
              { id: "y", imageUrl: "u", code: "ok" },
            ],
          })
        ),
      ],
    });
    expect(issues).toEqual([
      expect.objectContaining({
        kind: "invalid_format",
        reason: "invalid_characters",
        path: ["blocks", 0, "elements", 0, "choices", 0, "code"],
      }),
    ]);
  });

  test("tolerates blocks that are not shaped like blocks (draft payloads)", () => {
    expect(
      validateSurveyCodes({ blocks: [null, "x", { elements: "nope" }, { elements: [null, 3] }] })
    ).toEqual([]);
  });
});
