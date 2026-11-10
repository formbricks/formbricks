import { describe, expect, test } from "vitest";
import {
  decodeSonarMessage,
  parseStagedLineRanges,
  touchesStagedCode,
  touchesStagedLines,
} from "./staged-lines.mjs";

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

describe("decodeSonarMessage and touchesStagedCode", () => {
  const ranges: [number, number][] = [[12, 12]];
  const complexFunction = {
    line: 3,
    messageId: "sonarRuntime",
    message: JSON.stringify({
      message: "Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed.",
      secondaryLocations: [
        { line: 5, column: 2, endLine: 5, endColumn: 4, message: "+1" },
        { line: 12, column: 6, endLine: 12, endColumn: 8, message: "+2 (incl. 1 for nesting)" },
      ],
    }),
  };

  test("a function reported at an unstaged header touches the staged line that adds to it", () => {
    const decoded = decodeSonarMessage(complexFunction);
    expect(decoded.message).toBe(
      "Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed."
    );
    expect(touchesStagedLines(decoded, ranges)).toBe(false);
    expect(touchesStagedCode(decoded, ranges)).toBe(true);
  });

  test("a function none of whose increments is staged does not", () => {
    expect(touchesStagedCode(decodeSonarMessage(complexFunction), [[20, 30]])).toBe(false);
  });

  test("a plain message keeps its text and has no secondary locations", () => {
    const decoded = decodeSonarMessage({ line: 12, message: "Extract this nested ternary." });
    expect(decoded).toEqual({ line: 12, message: "Extract this nested ternary.", secondaryLocations: [] });
    expect(touchesStagedCode(decoded, ranges)).toBe(true);
  });
});
