import { describe, expect, test } from "vitest";
import { TColumnChoice, matchLabelsToColumns } from "./match-columns";

const existing = (column: number): TColumnChoice => ({ existing: column });
const create = (name: string): TColumnChoice => ({ create: name });

/**
 * Writes the labels the way both integrations do: existing columns keep their names, new ones are appended.
 * Returns the columns after the write and the column each label went to.
 */
const write = (columns: string[], labels: string[], legacyLabels: string[]) => {
  const next = [...columns];
  const placed = matchLabelsToColumns(columns, labels, legacyLabels).map((choice) => {
    if ("existing" in choice) return choice.existing;
    next.push(choice.create);
    return next.length - 1;
  });
  return { columns: next, placed };
};

// ENG-3682: "A B" is a two-paragraph headline's label after the fix, "AB" its legacy label.
describe("matchLabelsToColumns", () => {
  test("matches a label to the column with the same name", () => {
    expect(matchLabelsToColumns(["Created At", "A B"], ["A B"], ["AB"])).toEqual([existing(1)]);
  });

  test("falls back to the column with the legacy label", () => {
    expect(matchLabelsToColumns(["Created At", "AB"], ["A B"], ["AB"])).toEqual([existing(1)]);
  });

  test("prefers the new label when both columns exist", () => {
    expect(matchLabelsToColumns(["AB", "A B"], ["A B"], ["AB"])).toEqual([existing(1)]);
  });

  test("creates a column with the new label when neither exists", () => {
    expect(matchLabelsToColumns(["Created At"], ["A B"], ["AB"])).toEqual([create("A B")]);
  });

  test("matches a repeated unchanged label by occurrence, and repeats its name for a further one", () => {
    expect(
      matchLabelsToColumns(["Name", "Name"], ["Name", "Name", "Name"], ["Name", "Name", "Name"])
    ).toEqual([existing(0), existing(1), create("Name")]);
  });

  test("matches a repeated changed label to its legacy columns by occurrence", () => {
    expect(matchLabelsToColumns(["AB", "AB"], ["A B", "A B"], ["AB", "AB"])).toEqual([
      existing(0),
      existing(1),
    ]);
  });

  describe("when a changed label equals another question's label", () => {
    // q1 is `<p>A</p><p>B</p>` (now "A B", legacy "AB"); q2 is a plain "A B" headline.
    const labels = ["A B", "A B"];
    const legacyLabels = ["AB", "A B"];

    test("leaves the plain question its column and sends the changed one to its legacy column", () => {
      expect(matchLabelsToColumns(["AB", "A B"], labels, legacyLabels)).toEqual([existing(0), existing(1)]);
    });

    test("creates a column for each, the changed one under its legacy label", () => {
      expect(matchLabelsToColumns([], labels, legacyLabels)).toEqual([create("AB"), create("A B")]);
    });

    test("keeps each question in its column across writes", () => {
      const first = write([], labels, legacyLabels);
      const second = write(first.columns, labels, legacyLabels);
      expect(second).toEqual(first);
    });
  });

  test("never lets a legacy fallback take the column another question owns by its own label", () => {
    // q1 is `<p>A</p><p>B</p>` (legacy "AB"); q2 is a plain "AB" headline that owns the "AB" column.
    expect(matchLabelsToColumns(["AB"], ["A B", "AB"], ["AB", "AB"])).toEqual([create("A B"), existing(0)]);
  });

  test("keeps a repeated changed label's occurrences in their columns across writes", () => {
    // A sheet from before the fix has one "AB" column; a second "<p>A</p><p>B</p>" question was added.
    const first = write(["AB"], ["A B", "A B"], ["AB", "AB"]);
    expect(first).toEqual({ columns: ["AB", "A B"], placed: [0, 1] });
    expect(write(first.columns, ["A B", "A B"], ["AB", "AB"])).toEqual(first);
  });
});
