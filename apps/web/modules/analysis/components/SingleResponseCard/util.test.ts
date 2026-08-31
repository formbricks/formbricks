import { describe, expect, test } from "vitest";
import { isSubmissionTimeMoreThan5Minutes, isValidValue, splitRecallHighlights } from "./util";

describe("isValidValue", () => {
  test("returns false for an empty string", () => {
    expect(isValidValue("")).toBe(false);
  });

  test("returns false for a blank string", () => {
    expect(isValidValue("   ")).toBe(false);
  });

  test("returns true for a non-empty string", () => {
    expect(isValidValue("hello")).toBe(true);
  });

  test("returns true for numbers", () => {
    expect(isValidValue(0)).toBe(true);
    expect(isValidValue(42)).toBe(true);
  });

  test("returns false for an empty array", () => {
    expect(isValidValue([])).toBe(false);
  });

  test("returns true for a non-empty array", () => {
    expect(isValidValue(["item"])).toBe(true);
  });

  test("returns false for an empty object", () => {
    expect(isValidValue({})).toBe(false);
  });

  test("returns true for a non-empty object", () => {
    expect(isValidValue({ key: "value" })).toBe(true);
  });
});

describe("isSubmissionTimeMoreThan5Minutes", () => {
  test("returns true if submission time is more than 5 minutes ago", () => {
    const currentTime = new Date();
    const oldTime = new Date(currentTime.getTime() - 6 * 60 * 1000); // 6 minutes ago
    expect(isSubmissionTimeMoreThan5Minutes(oldTime)).toBe(true);
  });

  test("returns false if submission time is less than or equal to 5 minutes ago", () => {
    const currentTime = new Date();
    const recentTime = new Date(currentTime.getTime() - 4 * 60 * 1000); // 4 minutes ago
    expect(isSubmissionTimeMoreThan5Minutes(recentTime)).toBe(false);
  });
});

describe("splitRecallHighlights", () => {
  // The regex this replaces, as the oracle every case is compared against.
  const viaRegex = (text: string): string[] => text.split(/#\/(.*?)\\#/g);

  const FIXED = [
    "",
    "plain text",
    "before #/name\\# after",
    "#/a\\# and #/b\\#",
    "#/\\#",
    "#/unclosed",
    "#/spans\nnewline\\#",
    "#/one\\#\n#/two\\#",
    "text with \\# but no opener",
    "#/back\\slash inside\\#",
    "#/#/nested\\#",
    "#/a\\#trailing",
    "##//weird\\#",
    "#/\r\n\\#",
    "#/ \\#",
    // What a length cap got wrong: an over-long span containing another opener.
    `#/${"a".repeat(2000)}#/short\\#tail`,
  ];
  const ALPHABET = "#/\\ab\n\r ";
  const random = Array.from({ length: 30000 }, () => {
    const n = Math.floor(Math.random() * 24);
    let s = "";
    for (let i = 0; i < n; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return s;
  });

  test("matches the regex it replaces", () => {
    for (const text of [...FIXED, ...random]) {
      expect(splitRecallHighlights(text), `input: ${JSON.stringify(text)}`).toEqual(viaRegex(text));
    }
  });

  test("stays linear where the regex was quadratic", () => {
    // `#/` repeated with no closing `\#`: the regex expands to the end from every opener.
    const pathological = "#/".repeat(100000);

    const startedAt = performance.now();
    const parts = splitRecallHighlights(pathological);
    const elapsedMs = performance.now() - startedAt;

    expect(parts).toEqual([pathological]);
    expect(elapsedMs).toBeLessThan(500);
  });
});
