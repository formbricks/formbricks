import "@testing-library/jest-dom/vitest";
import { describe, expect, test } from "vitest";
import { matchMultipleOptionsByIdOrLabel, matchOptionByIdOrLabel } from "./matchers";

describe("matchOptionByIdOrLabel", () => {
  const choices = [
    { id: "choice-1", label: { en: "First", de: "Erste" } },
    { id: "choice-2", label: { en: "Second", de: "Zweite" } },
    { id: "other", label: { en: "Other", de: "Andere" } },
  ];

  test("matches by ID", () => {
    const result = matchOptionByIdOrLabel(choices, "choice-1", "en");
    expect(result).toEqual(choices[0]);
  });

  test("matches by label in English", () => {
    const result = matchOptionByIdOrLabel(choices, "First", "en");
    expect(result).toEqual(choices[0]);
  });

  test("matches by label in German", () => {
    const result = matchOptionByIdOrLabel(choices, "Zweite", "de");
    expect(result).toEqual(choices[1]);
  });

  test("prefers ID match over label match", () => {
    const choicesWithConflict = [
      { id: "First", label: { en: "Not First" } },
      { id: "choice-2", label: { en: "First" } },
    ];
    const result = matchOptionByIdOrLabel(choicesWithConflict, "First", "en");
    expect(result).toEqual(choicesWithConflict[0]); // Matches by ID, not label
  });

  test("returns null for no match", () => {
    const result = matchOptionByIdOrLabel(choices, "NonExistent", "en");
    expect(result).toBeNull();
  });

  test("returns null for empty string", () => {
    const result = matchOptionByIdOrLabel(choices, "", "en");
    expect(result).toBeNull();
  });

  test("handles special characters in labels", () => {
    const specialChoices = [{ id: "c1", label: { en: "Option (1)" } }];
    const result = matchOptionByIdOrLabel(specialChoices, "Option (1)", "en");
    expect(result).toEqual(specialChoices[0]);
  });
});

describe("matchMultipleOptionsByIdOrLabel", () => {
  const choices = [
    { id: "choice-1", label: { en: "First" } },
    { id: "choice-2", label: { en: "Second" } },
    { id: "choice-3", label: { en: "Third" } },
  ];

  test("matches multiple values by ID", () => {
    const result = matchMultipleOptionsByIdOrLabel(choices, ["choice-1", "choice-3"], "en");
    expect(result).toEqual([choices[0], choices[2]]);
  });

  test("matches multiple values by label", () => {
    const result = matchMultipleOptionsByIdOrLabel(choices, ["First", "Third"], "en");
    expect(result).toEqual([choices[0], choices[2]]);
  });

  test("matches mixed IDs and labels", () => {
    const result = matchMultipleOptionsByIdOrLabel(choices, ["choice-1", "Second", "choice-3"], "en");
    expect(result).toEqual([choices[0], choices[1], choices[2]]);
  });

  test("preserves order of values", () => {
    const result = matchMultipleOptionsByIdOrLabel(choices, ["Third", "First", "Second"], "en");
    expect(result).toEqual([choices[2], choices[0], choices[1]]);
  });

  test("skips non-matching values", () => {
    const result = matchMultipleOptionsByIdOrLabel(choices, ["First", "NonExistent", "Third"], "en");
    expect(result).toEqual([choices[0], choices[2]]);
  });

  test("returns empty array for all non-matching values", () => {
    const result = matchMultipleOptionsByIdOrLabel(choices, ["NonExistent1", "NonExistent2"], "en");
    expect(result).toEqual([]);
  });

  test("handles empty values array", () => {
    const result = matchMultipleOptionsByIdOrLabel(choices, [], "en");
    expect(result).toEqual([]);
  });
});
