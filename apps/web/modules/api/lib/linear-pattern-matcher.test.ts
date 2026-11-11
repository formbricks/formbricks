import fc from "fast-check";
import { describe, expect, test, vi } from "vitest";
import { validateBlockResponses } from "@formbricks/surveys/validation";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import {
  MAX_PATTERN_WORK_PER_RUN,
  MAX_PROGRAM_SIZE,
  createLinearPatternMatcher,
} from "./linear-pattern-matcher";

vi.mock("server-only", () => ({}));

const native = (pattern: string, flags: string | undefined, value: string): boolean =>
  new RegExp(pattern, flags).test(value);

// A fresh run per call, so the work budget never carries over between assertions.
const match = (pattern: string, flags: string | undefined, value: string) =>
  createLinearPatternMatcher()(pattern, flags, value);

const timed = <T>(fn: () => T): { result: T; ms: number } => {
  const started = performance.now();
  const result = fn();
  return { result, ms: performance.now() - started };
};

// Each takes the backtracking engine exponential (or high-polynomial) time on a short non-matching
// input; ^(a+)+$ alone blocked a request for 13 s at 28 characters. The last two are linear but slow per
// character in re2js (lookbehinds on its NFA; a huge compiled program), which the budget bounds.
const CATASTROPHIC_PATTERNS = [
  String.raw`^(a+)+$`,
  String.raw`^(a|aa)+$`,
  String.raw`^(a|a?)+$`,
  String.raw`^(\w+\s?)*$`,
  String.raw`^([a-zA-Z0-9]+\.?)+@example\.com$`,
  String.raw`(.*a){12}`,
  "(?:(?<=a)a|(?<=b)b){1000}".repeat(20),
  "(?:a|b){1000}".repeat(39),
];

// Patterns survey authors actually write, plus the syntax the translation and `\s`/`\S` rewrite touch.
const COMMON_PATTERNS: Array<[string, string | undefined]> = [
  [String.raw`^\d{5}$`, undefined],
  [String.raw`^[A-Z]{2}\d{6}$`, undefined],
  [String.raw`^[a-z]+$`, "i"],
  [String.raw`^\+?\d[\d\s-]{6,}$`, undefined],
  [String.raw`^[\w.+-]+@[\w-]+\.[\w.]+$`, undefined],
  [String.raw`^\s*$`, undefined],
  [String.raw`^\S+$`, undefined],
  [String.raw`^\d{3}\s?\d{3}$`, undefined],
  [String.raw`^[^\s]+$`, undefined],
  [String.raw`^[^\S\r\n]+$`, undefined],
  [String.raw`^a[^\S]b$`, undefined],
  [String.raw`[\s,;]`, undefined],
  [String.raw`\\s`, undefined],
  [String.raw`^a.b$`, "s"],
  [String.raw`^a.b$`, undefined],
  [String.raw`^b`, "m"],
  [String.raw`a$`, "m"],
  [String.raw`^(?<word>\w+)$`, undefined],
  [String.raw`\u00e9`, undefined],
  [String.raw`^\p{L}+$`, "u"],
  [String.raw`^.{3}$`, "u"],
  [String.raw`[]a]`, undefined],
  [String.raw`[^]`, undefined],
];

describe("createLinearPatternMatcher", () => {
  test.each(CATASTROPHIC_PATTERNS)("returns quickly on a 4096-character answer to %s", (pattern) => {
    const { result, ms } = timed(() => match(pattern, undefined, `${"ab".repeat(2047)}a!`));

    expect(result === undefined || typeof result === "boolean").toBe(true);
    // The backtracking engine would not return within the test timeout.
    expect(ms).toBeLessThan(1000);
  });

  test("refuses rules once a run has spent its budget, instead of running them", () => {
    const run = createLinearPatternMatcher(10_000);
    const value = "a".repeat(100);

    expect(run("^a+$", undefined, value)).toBe(true);
    let refusedAfter = 0;
    while (run("^a+$", undefined, value) === true) refusedAfter++;

    expect(refusedAfter).toBeGreaterThan(0);
    expect(run("^a+$", undefined, value)).toBe(false);
    // A new run starts with a full budget.
    expect(createLinearPatternMatcher(10_000)("^a+$", undefined, value)).toBe(true);
  });

  test("bounds one run's total time, however many pathological rules a survey carries", () => {
    const run = createLinearPatternMatcher();
    // ~2,000 instructions: under the program cap, so each rule would run.
    const pattern = "(?:a|b){1000}".repeat(2);
    const value = `${"ab".repeat(2047)}c!`;

    const { ms } = timed(() => {
      for (let i = 0; i < 50; i++) run(pattern, undefined, value);
    });

    expect(ms).toBeLessThan(1500);
  });

  test("does not run a pattern that compiles past the program cap, and remembers it", () => {
    const pattern = ".{1000}".repeat(72);

    const first = timed(() => match(pattern, undefined, "a"));
    const second = timed(() => match(pattern, undefined, "a"));

    expect(first.result).toBeUndefined();
    expect(second.result).toBeUndefined();
    // The second response skips the ~60 ms compile.
    expect(second.ms).toBeLessThan(5);
    expect(MAX_PROGRAM_SIZE).toBeLessThan(72_000);
  });

  test("keeps a long but realistic pattern under the program cap", () => {
    expect(match("^.{1,1000}$", undefined, "a".repeat(1000))).toBe(true);
  });

  test("leaves real surveys far inside the budget", () => {
    const run = createLinearPatternMatcher();
    const answer = "someone.name+tag@example-company.com";
    for (let i = 0; i < 500; i++) {
      expect(run(String.raw`^[\w.+-]+@[\w-]+\.[\w.]+$`, undefined, answer)).toBe(true);
    }
    expect(MAX_PATTERN_WORK_PER_RUN).toBeGreaterThan(500 * 100 * answer.length);
  });

  test.each([
    ["^\\d{5}$", undefined, "12345", true],
    ["^\\d{5}$", undefined, "1234a", false],
    ["^[a-z]+$", "i", "ABC", true],
    ["^b", "m", "a\nb", true],
    ["^b", undefined, "a\nb", false],
    ["a.b", "s", "a\nb", true],
    ["a.b", undefined, "a\nb", false],
  ] as const)("matches %s (flags %s) against %j like RegExp", (pattern, flags, value, expected) => {
    expect(match(pattern, flags, value)).toBe(expected);
    expect(native(pattern, flags, value)).toBe(expected);
  });

  test("splits whitespace from non-whitespace where the browser does", () => {
    for (const space of ["\u00a0", "\u2007", "\u202f", "\u3000", "\ufeff", "\u000b"]) {
      expect(match(String.raw`^\d{3}\s\d{3}$`, undefined, `123${space}456`)).toBe(true);
      expect(match(String.raw`^[\s]+$`, undefined, space)).toBe(true);
      expect(match(String.raw`^[^\s]+$`, undefined, space)).toBe(false);
      expect(match(String.raw`^\S$`, undefined, space)).toBe(false);
      expect(match(String.raw`^[^\S\r\n]$`, undefined, space)).toBe(true);
    }
  });

  test("leaves an escaped backslash followed by s alone", () => {
    expect(match(String.raw`^\\s$`, undefined, String.raw`\s`)).toBe(true);
    expect(match(String.raw`^\\s$`, undefined, " ")).toBe(false);
  });

  test.each([
    ["(?=a)a", undefined, "lookahead"],
    ["(?!a)b", undefined, "negative lookahead"],
    ["(?<=a)b", undefined, "lookbehind"],
    ["(a)\\1", undefined, "backreference"],
    ["^(?<n>a)\\k<n>$", undefined, "named backreference"],
    ["^(?<n>a)\\k<n>$", "u", "named backreference with u"],
    ["\\Aa", undefined, "\\A is the letter A without u"],
    ["a\\z", undefined, "\\z is the letter z without u"],
    ["\\Qa\\E", undefined, "\\Q and \\E are letters without u"],
    ["\\p{L}", undefined, "\\p is the letter p without u"],
    ["[invalid", undefined, "invalid pattern"],
    ["a", "q", "invalid flag"],
  ])("does not evaluate %s (flags %s): %s", (pattern, flags) => {
    expect(match(pattern, flags, "a")).toBeUndefined();
  });

  test("does not evaluate a multiline pattern against an answer with a line break RE2 does not see", () => {
    for (const lineBreak of ["\r", "\u2028", "\u2029"]) {
      expect(match("^b", "m", `a${lineBreak}b`)).toBeUndefined();
    }
    expect(match("^b", "m", "a\nb")).toBe(true);
  });

  test("agrees with RegExp on printable ASCII answers", () => {
    const asciiAnswer = fc.string({
      unit: fc.constantFrom(..."aAbBzZ019 -_.@+,;\t\n\\".split("")),
      maxLength: 16,
    });
    fc.assert(
      fc.property(fc.constantFrom(...COMMON_PATTERNS), asciiAnswer, ([pattern, flags], value) => {
        expect(match(pattern, flags, value)).toBe(native(pattern, flags, value));
      }),
      { numRuns: 3000 }
    );
  });

  // The server must never refuse an answer the respondent's browser accepted.
  test("never refuses an answer RegExp accepts, whatever the characters", () => {
    const anyAnswer = fc.string({
      unit: fc.constantFrom(
        ..."aAbB1 \t\n\r\u000b\u00a0\u2028\u2029\u3000\ufeff\u00e9\u017f\u212a-.".split(""),
        "\u{1F600}"
      ),
      maxLength: 12,
    });
    fc.assert(
      fc.property(fc.constantFrom(...COMMON_PATTERNS), anyAnswer, ([pattern, flags], value) => {
        if (/\p{Extended_Pictographic}/u.test(value) && !flags?.includes("u") && pattern.includes(".")) {
          // Documented exception: without `u` the browser counts an emoji as two characters.
          return;
        }
        if (native(pattern, flags, value)) {
          expect(match(pattern, flags, value)).not.toBe(false);
        }
      }),
      { numRuns: 5000 }
    );
  });
});

describe("validateBlockResponses with the linear-time matcher", () => {
  const element = {
    id: "q1",
    type: TSurveyElementTypeEnum.OpenText,
    headline: { default: "Code" },
    required: false,
    inputType: "text",
    charLimit: { enabled: false },
    validation: {
      logic: "and",
      rules: [{ id: "r1", type: "pattern", params: { pattern: "^(a+)+$" } }],
    },
  } as unknown as TSurveyElement;

  test("rejects a non-matching answer to a catastrophic pattern in linear time", () => {
    const { result: errors, ms } = timed(() =>
      validateBlockResponses([element], { q1: `${"a".repeat(4095)}!` }, "default", {
        matchPattern: createLinearPatternMatcher(),
      })
    );

    expect(errors.q1?.[0]?.ruleType).toBe("pattern");
    expect(ms).toBeLessThan(1000);
  });

  test("accepts a matching answer", () => {
    expect(
      validateBlockResponses([element], { q1: "a".repeat(4096) }, "default", {
        matchPattern: createLinearPatternMatcher(),
      })
    ).toEqual({});
  });
});
