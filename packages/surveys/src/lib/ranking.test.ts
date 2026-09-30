import { describe, expect, test } from "vitest";
import { rankingValueToSelection, selectionToRankingValue } from "./ranking";

const options = [
  { id: "a", label: "Price" },
  { id: "b", label: "Speed" },
  { id: "other", label: "Other" },
];

describe("rankingValueToSelection", () => {
  test("maps labels to ids in rank order", () => {
    expect(rankingValueToSelection(["Speed", "Price"], options, "other")).toEqual({
      selectedIds: ["b", "a"],
      otherValue: "",
    });
  });

  test("accepts ids stored before labels were used", () => {
    expect(rankingValueToSelection(["b", "a"], options, "other").selectedIds).toEqual(["b", "a"]);
  });

  test("resolves an unmatched entry to Other, keeping its rank and text", () => {
    expect(rankingValueToSelection(["Price", "Integrations", "Speed"], options, "other")).toEqual({
      selectedIds: ["a", "other", "b"],
      otherValue: "Integrations",
    });
  });

  test("resolves an empty entry to a ranked Other with no text yet", () => {
    expect(rankingValueToSelection(["", "Price"], options, "other")).toEqual({
      selectedIds: ["other", "a"],
      otherValue: "",
    });
  });

  test("treats text equal to the Other label or id as the respondent's text", () => {
    expect(rankingValueToSelection(["other"], options, "other")).toEqual({
      selectedIds: ["other"],
      otherValue: "other",
    });
    expect(rankingValueToSelection(["Other"], options, "other").otherValue).toBe("Other");
  });

  test("treats text that repeats an already ranked label as the Other text", () => {
    expect(rankingValueToSelection(["Price", "Price"], options, "other")).toEqual({
      selectedIds: ["a", "other"],
      otherValue: "Price",
    });
  });

  test("drops unmatched entries when the element has no Other option", () => {
    const withoutOther = options.filter((option) => option.id !== "other");
    expect(rankingValueToSelection(["Price", "Integrations"], withoutOther, undefined)).toEqual({
      selectedIds: ["a"],
      otherValue: "",
    });
  });

  test("only one entry can become Other", () => {
    expect(rankingValueToSelection(["x", "y"], options, "other").selectedIds).toEqual(["other"]);
  });
});

describe("selectionToRankingValue", () => {
  test("stores labels in rank order with the typed text in the Other slot", () => {
    expect(selectionToRankingValue(["b", "other", "a"], options, "other", "Integrations")).toEqual([
      "Speed",
      "Integrations",
      "Price",
    ]);
  });

  test("keeps an empty slot for a ranked Other with no text", () => {
    expect(selectionToRankingValue(["other"], options, "other", "")).toEqual([""]);
  });

  test("drops ids that match no option", () => {
    expect(selectionToRankingValue(["gone", "a"], options, "other", "")).toEqual(["Price"]);
  });

  test("round-trips through rankingValueToSelection", () => {
    const value = ["Integrations", "Speed"];
    const { selectedIds, otherValue } = rankingValueToSelection(value, options, "other");
    expect(selectionToRankingValue(selectedIds, options, "other", otherValue)).toEqual(value);
  });
});
