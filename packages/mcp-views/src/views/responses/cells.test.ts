import { describe, expect, test } from "vitest";
import {
  CELL_MAX_CHARS,
  MAX_ANSWER_ENTRIES,
  answerToCell,
  answerToLines,
  deriveColumns,
  mergeColumns,
  mergeRows,
  toViewRow,
  truncate,
} from "./cells";
import type { ViewRow } from "./types";

const answer = (extra: Record<string, unknown>) => ({
  position: 1,
  elementId: "q1",
  elementLabel: "Question",
  elementType: "openText",
  ...extra,
});

describe("truncate", () => {
  test("leaves short text alone and cuts long text with an ellipsis", () => {
    expect(truncate("short", 10)).toBe("short");
    expect(truncate("abcdefghij", 5)).toBe("abcde…");
  });

  test("does not split a surrogate pair", () => {
    // "a" + "😀" is three UTF-16 units; a cut after two would leave half an emoji.
    expect(truncate("a😀b", 2)).toBe("a…");
  });
});

describe("answerToLines", () => {
  test("renders free text, dates and booleans by element type", () => {
    expect(answerToLines(answer({ valueText: "Great product" }))).toEqual(["Great product"]);
    expect(answerToLines(answer({ elementType: "date", valueDate: "2026-03-01" }))).toEqual(["2026-03-01"]);
    expect(answerToLines(answer({ elementType: "consent", valueBoolean: true }))).toEqual(["Accepted"]);
    expect(answerToLines(answer({ elementType: "consent", valueBoolean: false }))).toEqual(["Not accepted"]);
    expect(answerToLines(answer({ elementType: "cta", valueBoolean: true }))).toEqual(["Clicked"]);
    expect(answerToLines(answer({ elementType: "cal", booked: false }))).toEqual(["Not booked"]);
  });

  test("shows a rating against its range but an NPS score bare", () => {
    expect(
      answerToLines(answer({ elementType: "rating", valueNumber: 4, range: { min: 1, max: 5 } }))
    ).toEqual(["4 / 5"]);
    expect(answerToLines(answer({ elementType: "nps", valueNumber: 9, range: { min: 0, max: 10 } }))).toEqual(
      ["9"]
    );
  });

  test("prefers the option label, falls back to the raw value, and orders a ranking by rank", () => {
    expect(
      answerToLines(
        answer({
          elementType: "multipleChoiceMulti",
          selections: [
            { optionId: "a", optionLabel: "Email", rawValue: "email" },
            { optionId: null, optionLabel: null, rawValue: "Carrier pigeon" },
          ],
        })
      )
    ).toEqual(["Email", "Carrier pigeon"]);

    expect(
      answerToLines(
        answer({
          elementType: "ranking",
          selections: [
            { optionLabel: "Second", rawValue: "b", rank: 2 },
            { optionLabel: "First", rawValue: "a", rank: 1 },
          ],
        })
      )
    ).toEqual(["1. First", "2. Second"]);
  });

  test("renders matrix rows, composite fields and file counts", () => {
    expect(
      answerToLines(
        answer({
          elementType: "matrix",
          rows: [{ rawKey: "r1", rowLabel: "Speed", columnLabel: "Good", rawValue: "good" }],
        })
      )
    ).toEqual(["Speed: Good"]);
    expect(
      answerToLines(
        answer({
          elementType: "address",
          fields: [
            { slot: 0, fieldId: "addressLine1", fieldLabel: "Street", valueText: "1 Main St" },
            { slot: 2, fieldId: "city", fieldLabel: "City", valueText: "  " },
          ],
        })
      )
    ).toEqual(["Street: 1 Main St"]);
    expect(answerToLines(answer({ elementType: "fileUpload", fileUrls: ["a", "b"] }))).toEqual(["2 files"]);
    expect(answerToLines(answer({ elementType: "fileUpload", fileUrls: ["a"], fileCount: 1 }))).toEqual([
      "1 file",
    ]);
  });

  test("caps a long list and marks the cut", () => {
    const selections = Array.from({ length: MAX_ANSWER_ENTRIES + 5 }, (_, index) => ({
      optionLabel: `Option ${index}`,
      rawValue: String(index),
    }));
    const lines = answerToLines(answer({ elementType: "multipleChoiceMulti", selections }));
    expect(lines).toHaveLength(MAX_ANSWER_ENTRIES + 1);
    expect(lines.at(-1)).toBe("and 5 more");
  });

  test("yields nothing for a shape it does not know", () => {
    expect(answerToLines(answer({ somethingNew: { nested: true } }))).toEqual([]);
  });
});

describe("answerToCell", () => {
  test("flattens whitespace and joins entries on one line", () => {
    expect(answerToCell(answer({ valueText: "line one\n\n   line two" }))).toBe("line one line two");
    expect(
      answerToCell(
        answer({
          elementType: "multipleChoiceMulti",
          selections: [
            { optionLabel: "A", rawValue: "a" },
            { optionLabel: "B", rawValue: "b" },
          ],
        })
      )
    ).toBe("A, B");
  });

  test("caps a huge free-text answer", () => {
    const cell = answerToCell(answer({ valueText: "x".repeat(CELL_MAX_CHARS * 10) }));
    expect(cell).toHaveLength(CELL_MAX_CHARS + 1);
    expect(cell.endsWith("…")).toBe(true);
  });

  test("keeps markup as inert text", () => {
    expect(answerToCell(answer({ valueText: "<img src=x onerror=alert(1)>" }))).toBe(
      "<img src=x onerror=alert(1)>"
    );
  });
});

describe("toViewRow", () => {
  const item = {
    id: "r1",
    createdAt: "2026-03-01T10:00:00.000Z",
    finished: true,
    language: "en",
    tags: [{ id: "t1", name: "vip" }],
    answers: [answer({ valueText: "Hello" }), answer({ elementId: "q2", position: 2, valueText: "" })],
  };

  test("keeps answered cells and drops empty ones", () => {
    expect(toViewRow(item)).toEqual({
      id: "r1",
      createdAt: "2026-03-01T10:00:00.000Z",
      finished: true,
      language: "en",
      tags: ["vip"],
      cells: { q1: "Hello" },
    });
  });

  test("rejects anything that is not a response", () => {
    expect(toViewRow(null)).toBeUndefined();
    expect(toViewRow({ id: "r1" })).toBeUndefined();
    expect(toViewRow({ ...item, finished: "yes" })).toBeUndefined();
  });
});

describe("columns", () => {
  test("derive in survey order across items and merge without reordering what is known", () => {
    const columns = deriveColumns([
      { answers: [answer({ elementId: "q2", position: 2, elementLabel: "Second" })] },
      {
        answers: [
          answer({ elementId: "q1", position: 1, elementLabel: "First" }),
          answer({ elementId: "q2", position: 2 }),
        ],
      },
    ]);
    expect(columns.map((column) => column.id)).toEqual(["q1", "q2"]);
    expect(columns[1]?.label).toBe("Second");

    const merged = mergeColumns(columns, [
      { id: "q3", label: "Third", type: "nps", position: 3 },
      { id: "q1", label: "Renamed", type: "openText", position: 1 },
    ]);
    expect(merged.map((column) => column.id)).toEqual(["q1", "q2", "q3"]);
    expect(merged[0]?.label).toBe("First");
  });

  test("a later page can slot a question in between by its position", () => {
    const merged = mergeColumns(
      [
        { id: "q1", label: "A", type: "openText", position: 1 },
        { id: "q3", label: "C", type: "openText", position: 3 },
      ],
      [{ id: "q2", label: "B", type: "openText", position: 2 }]
    );
    expect(merged.map((column) => column.id)).toEqual(["q1", "q2", "q3"]);
  });
});

describe("mergeRows", () => {
  const row = (id: string): ViewRow => ({
    id,
    createdAt: "2026-03-01T10:00:00.000Z",
    finished: true,
    language: null,
    tags: [],
    cells: {},
  });

  test("appends new rows and skips duplicates", () => {
    expect(mergeRows([row("a"), row("b")], [row("b"), row("c")]).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});
