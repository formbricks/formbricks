import { describe, expect, test } from "vitest";
import { matchLabelsToColumns } from "./match-columns";

// ENG-3682: "A B" is a two-paragraph headline's label after the fix, "AB" its legacy label.
describe("matchLabelsToColumns", () => {
  test("matches a label to the column with the same name", () => {
    expect(matchLabelsToColumns(["Created At", "A B"], ["A B"], ["AB"])).toEqual([1]);
  });

  test("falls back to the column with the legacy label", () => {
    expect(matchLabelsToColumns(["Created At", "AB"], ["A B"], ["AB"])).toEqual([1]);
  });

  test("prefers the new label when both columns exist", () => {
    expect(matchLabelsToColumns(["AB", "A B"], ["A B"], ["AB"])).toEqual([1]);
  });

  test("leaves a label with neither column unmatched", () => {
    expect(matchLabelsToColumns(["Created At"], ["A B"], ["AB"])).toEqual([undefined]);
  });

  test("matches a repeated label by occurrence, in both forms", () => {
    expect(
      matchLabelsToColumns(["Name", "Name"], ["Name", "Name", "Name"], ["Name", "Name", "Name"])
    ).toEqual([0, 1, undefined]);
    expect(matchLabelsToColumns(["AB", "AB"], ["A B", "A B"], ["AB", "AB"])).toEqual([0, 1]);
  });

  test("never lets a legacy fallback take the column another question owns by its own label", () => {
    // q1 is `<p>A</p><p>B</p>` (legacy "AB"); q2 is a plain "AB" headline that owns the "AB" column.
    expect(matchLabelsToColumns(["AB"], ["A B", "AB"], ["AB", "AB"])).toEqual([undefined, 0]);
  });
});
