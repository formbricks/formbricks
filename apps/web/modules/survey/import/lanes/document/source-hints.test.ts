import { describe, expect, test } from "vitest";
import { applySourceHints } from "./source-hints";

const TABLE = [
  "| Block # | Question Type | Question Text | Options / Scale | Required |",
  "| --- | --- | --- | --- | --- |",
  "| 02 | Single Select | Which single option applies? | Option A; Option B | Yes |",
  "| 03 | Single Select (dropdown) | Pick a colour from the list. | Red; Green; Blue | Yes |",
  "| 05 | Single Select | Do you like dropdown menus? | Yes; No | No |",
  "| 11 | Matrix | Rate each aspect. | Rows: Staff; Facilities; Value \\| Columns: Poor; OK; Good | No |",
  "| 12 | Matrix | Rate the venue. | Rows: Food \\| Columns: Bad; Fine | No |",
].join("\n");

const single = (headline: unknown, extra: Record<string, unknown> = {}) => ({
  type: "multipleChoiceSingle",
  headline,
  required: true,
  choices: ["A", "B"],
  ...extra,
});

const draft = (...questions: Record<string, unknown>[]) => ({
  language: "en-US",
  name: "Sample",
  blocks: [{ name: "Block 1", questions }],
});

const questionsOf = (result: unknown) =>
  (result as { blocks: { questions: Record<string, unknown>[] }[] }).blocks[0].questions;

describe("applySourceHints", () => {
  test("a single-choice question whose type cell says dropdown gets dropdown: true", () => {
    const [plain, dropdown] = questionsOf(
      applySourceHints(
        draft(single("Which single option applies?"), single("Pick a colour from the list.")),
        TABLE
      )
    );
    expect(plain.dropdown).toBeUndefined();
    expect(dropdown.dropdown).toBe(true);
  });

  test("the word dropdown inside the headline itself is not a hint", () => {
    const [question] = questionsOf(applySourceHints(draft(single("Do you like dropdown menus?")), TABLE));
    expect(question.dropdown).toBeUndefined();
  });

  test("a matrix without rows or columns takes them from the Rows/Columns cell, in the headline's language shape", () => {
    const localized = [
      { languageCode: "en-US", text: "Rate each aspect." },
      { languageCode: "de-DE", text: "Bewerten Sie jeden Aspekt." },
    ];
    const [question] = questionsOf(
      applySourceHints(draft({ type: "matrix", headline: localized, required: false, choices: null }), TABLE)
    );
    expect(question.type).toBe("matrix");
    expect(question.rows).toEqual([
      [
        { languageCode: "en-US", text: "Staff" },
        { languageCode: "de-DE", text: "Staff" },
      ],
      [
        { languageCode: "en-US", text: "Facilities" },
        { languageCode: "de-DE", text: "Facilities" },
      ],
      [
        { languageCode: "en-US", text: "Value" },
        { languageCode: "de-DE", text: "Value" },
      ],
    ]);
    expect(question.columns).toHaveLength(3);
    expect((question.columns as unknown[][])[0]).toEqual([
      { languageCode: "en-US", text: "Poor" },
      { languageCode: "de-DE", text: "Poor" },
    ]);
  });

  test("a free-text approximation of a row the document calls a matrix becomes a matrix", () => {
    const [question] = questionsOf(
      applySourceHints(
        draft({
          type: "openText",
          headline: "Rate the venue.",
          required: false,
          choices: null,
          longAnswer: true,
        }),
        TABLE
      )
    );
    expect(question).toMatchObject({
      type: "matrix",
      rows: ["Food"],
      columns: ["Bad", "Fine"],
      choices: null,
    });
  });

  test("rows and columns the model already found are kept", () => {
    const [question] = questionsOf(
      applySourceHints(
        draft({
          type: "matrix",
          headline: "Rate each aspect.",
          required: false,
          choices: null,
          rows: ["S"],
          columns: ["P", "G"],
        }),
        TABLE
      )
    );
    expect(question).toMatchObject({ rows: ["S"], columns: ["P", "G"] });
  });

  test("a question whose headline is not in the text, or a non-draft, passes through untouched", () => {
    const untouched = single("Something the document never said");
    expect(questionsOf(applySourceHints(draft(untouched), TABLE))[0]).toEqual(untouched);
    expect(applySourceHints({ garbage: true }, TABLE)).toEqual({ garbage: true });
  });
});
