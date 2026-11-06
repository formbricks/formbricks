import { describe, expect, test } from "vitest";
import { parseStagedLineRanges, touchesStagedLines } from "./staged-lines.mjs";

const DIFF = [
  "diff --git a/f.ts b/f.ts",
  "@@ -3,0 +4,2 @@ export const a = 1;",
  "+const b = 2;",
  "+const c = 3;",
  "@@ -10 +12 @@",
  "-old",
  "+new",
  "@@ -20,3 +23,0 @@",
  "-gone",
].join("\n");

describe("parseStagedLineRanges", () => {
  test("reads each hunk's added lines, a single line without a count, and skips a pure deletion", () => {
    expect(parseStagedLineRanges(DIFF)).toEqual([
      [4, 5],
      [12, 12],
    ]);
  });

  test("an empty diff stages nothing", () => {
    expect(parseStagedLineRanges("")).toEqual([]);
  });
});

describe("touchesStagedLines", () => {
  const ranges: [number, number][] = [
    [4, 5],
    [12, 12],
  ];

  test("a message inside, or spanning, a staged range touches it", () => {
    expect(touchesStagedLines({ line: 5 }, ranges)).toBe(true);
    expect(touchesStagedLines({ line: 1, endLine: 30 }, ranges)).toBe(true);
  });

  test("a message only on untouched lines does not", () => {
    expect(touchesStagedLines({ line: 6, endLine: 11 }, ranges)).toBe(false);
    expect(touchesStagedLines({ line: 40 }, ranges)).toBe(false);
  });
});
