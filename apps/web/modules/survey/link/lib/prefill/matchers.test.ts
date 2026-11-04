import "@testing-library/jest-dom/vitest";
import { describe, expect, test } from "vitest";
import { matchOption, matchOptions } from "./matchers";

describe("matchOption", () => {
  const choices = [
    { id: "choice-1", label: { en: "First", de: "Erste" } },
    { id: "choice-2", label: { en: "Second", de: "Zweite" } },
    { id: "other", label: { en: "Other", de: "Andere" } },
  ];

  test("matches by ID", () => {
    const result = matchOption(choices, "choice-1", "en");
    expect(result).toEqual(choices[0]);
  });

  test("matches by label in English", () => {
    const result = matchOption(choices, "First", "en");
    expect(result).toEqual(choices[0]);
  });

  test("matches by label in German", () => {
    const result = matchOption(choices, "Zweite", "de");
    expect(result).toEqual(choices[1]);
  });

  test("prefers ID match over label match", () => {
    const choicesWithConflict = [
      { id: "First", label: { en: "Not First" } },
      { id: "choice-2", label: { en: "First" } },
    ];
    const result = matchOption(choicesWithConflict, "First", "en");
    expect(result).toEqual(choicesWithConflict[0]); // Matches by ID, not label
  });

  test("returns null for no match", () => {
    const result = matchOption(choices, "NonExistent", "en");
    expect(result).toBeNull();
  });

  test("returns null for empty string", () => {
    const result = matchOption(choices, "", "en");
    expect(result).toBeNull();
  });

  test("handles special characters in labels", () => {
    const specialChoices = [{ id: "c1", label: { en: "Option (1)" } }];
    const result = matchOption(specialChoices, "Option (1)", "en");
    expect(result).toEqual(specialChoices[0]);
  });
});

describe("matchOptions", () => {
  const choices = [
    { id: "choice-1", label: { en: "First" } },
    { id: "choice-2", label: { en: "Second" } },
    { id: "choice-3", label: { en: "Third" } },
  ];

  test("matches multiple values by ID", () => {
    const result = matchOptions(choices, ["choice-1", "choice-3"], "en");
    expect(result).toEqual([choices[0], choices[2]]);
  });

  test("matches multiple values by label", () => {
    const result = matchOptions(choices, ["First", "Third"], "en");
    expect(result).toEqual([choices[0], choices[2]]);
  });

  test("matches mixed IDs and labels", () => {
    const result = matchOptions(choices, ["choice-1", "Second", "choice-3"], "en");
    expect(result).toEqual([choices[0], choices[1], choices[2]]);
  });

  test("preserves order of values", () => {
    const result = matchOptions(choices, ["Third", "First", "Second"], "en");
    expect(result).toEqual([choices[2], choices[0], choices[1]]);
  });

  test("skips non-matching values", () => {
    const result = matchOptions(choices, ["First", "NonExistent", "Third"], "en");
    expect(result).toEqual([choices[0], choices[2]]);
  });

  test("returns empty array for all non-matching values", () => {
    const result = matchOptions(choices, ["NonExistent1", "NonExistent2"], "en");
    expect(result).toEqual([]);
  });

  test("handles empty values array", () => {
    const result = matchOptions(choices, [], "en");
    expect(result).toEqual([]);
  });
});

describe("matching by answer code", () => {
  const coded = [
    { id: "choice-1", label: { en: "First", de: "Erste" }, code: "1" },
    { id: "choice-2", label: { en: "Second", de: "Zweite" }, code: "2" },
    { id: "other", label: { en: "Other", de: "Andere" }, code: "98" },
  ];

  test("matches by answer code when ID and label do not match", () => {
    expect(matchOption(coded, "2", "en")).toEqual(coded[1]);
    expect(matchOption(coded, "98", "en")).toEqual(coded[2]);
  });

  test("an ID wins over a label, a label wins over a code", () => {
    const choices = [
      { id: "a", label: { en: "x" }, code: "b" },
      { id: "b", label: { en: "y" }, code: "c" },
      { id: "c", label: { en: "b" }, code: "d" },
    ];
    expect(matchOption(choices, "b", "en")).toEqual(choices[1]); // ID of choice 2, not code of 1 or label of 3
    expect(matchOption(choices, "y", "en")).toEqual(choices[1]);
    expect(matchOption(choices, "d", "en")).toEqual(choices[2]); // only a code
  });

  test("a label that looks like another option's code wins", () => {
    const choices = [
      { id: "a", label: { en: "1" }, code: "2" },
      { id: "b", label: { en: "2" }, code: "1" },
    ];
    expect(matchOption(choices, "1", "en")).toEqual(choices[0]);
    expect(matchOption(choices, "2", "en")).toEqual(choices[1]);
  });

  test("the code is exact and case-sensitive", () => {
    const choices = [{ id: "a", label: { en: "Yes" }, code: "yes_1" }];
    expect(matchOption(choices, "YES_1", "en")).toBeNull();
    expect(matchOption(choices, " yes_1", "en")).toBeNull();
    expect(matchOption(choices, "yes_1", "en")).toEqual(choices[0]);
  });

  test("a choice without a code, or with an empty one, never matches", () => {
    const choices = [
      { id: "a", label: { en: "A" } },
      { id: "b", label: { en: "B" }, code: "" },
    ];
    expect(matchOption(choices, "", "en")).toBeNull();
    expect(matchOption(choices, "undefined", "en")).toBeNull();
  });

  test("matchOptions resolves codes in value order and keeps duplicates", () => {
    expect(matchOptions(coded, ["2", "1", "2"], "en")).toEqual([coded[1], coded[0], coded[1]]);
  });

  test("matchOptions mixes ID, label and code", () => {
    expect(matchOptions(coded, ["choice-1", "Second", "98"], "en")).toEqual([coded[0], coded[1], coded[2]]);
  });
});
