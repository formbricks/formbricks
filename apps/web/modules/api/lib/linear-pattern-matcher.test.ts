import fc from "fast-check";
import { describe, expect, test, vi } from "vitest";
import { validateBlockResponses } from "@formbricks/surveys/validation";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { matchPatternInLinearTime } from "./linear-pattern-matcher";

vi.mock("server-only", () => ({}));

const native = (pattern: string, flags: string | undefined, value: string): boolean =>
  new RegExp(pattern, flags).test(value);

// Each of these takes the backtracking engine exponential (or high-polynomial) time on a short
// non-matching input; ^(a+)+$ alone blocked a request for 13 s at 28 characters.
const CATASTROPHIC_PATTERNS = [
  String.raw`^(a+)+$`,
  String.raw`^(a|aa)+$`,
  String.raw`^(a|a?)+$`,
  String.raw`^(\w+\s?)*$`,
  String.raw`^([a-zA-Z0-9]+\.?)+@example\.com$`,
  String.raw`(.*a){12}`,
];

// Patterns survey authors actually write, plus the syntax the translation and `\s` rewrite touch.
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
  [String.raw`[\s,;]`, undefined],
  [String.raw`\\s`, undefined],
  [String.raw`^a.b$`, "s"],
  [String.raw`^b`, "m"],
  [String.raw`^(?<word>\w+)$`, undefined],
  [String.raw`\u00e9`, undefined],
  [String.raw`^\p{L}+$`, "u"],
  [String.raw`(?<=@)\w+`, undefined],
  [String.raw`^.{3}$`, "u"],
  [String.raw`[]a]`, undefined],
  [String.raw`[^]`, undefined],
];

describe("matchPatternInLinearTime", () => {
  test.each(CATASTROPHIC_PATTERNS)(
    "evaluates %s on a 4096-character answer without backtracking",
    (pattern) => {
      const value = `${"a".repeat(4095)}!`;
      const started = performance.now();

      const result = matchPatternInLinearTime(pattern, undefined, value);

      expect(typeof result).toBe("boolean");
      // The backtracking engine would not return within the test timeout; RE2 takes milliseconds.
      expect(performance.now() - started).toBeLessThan(1000);
    }
  );

  test.each([
    ["^\\d{5}$", undefined, "12345", true],
    ["^\\d{5}$", undefined, "1234a", false],
    ["^[a-z]+$", "i", "ABC", true],
    ["^b", "m", "a\nb", true],
    ["^b", undefined, "a\nb", false],
    ["a.b", "s", "a\nb", true],
    ["a.b", undefined, "a\nb", false],
  ] as const)("matches %s (flags %s) against %j like RegExp", (pattern, flags, value, expected) => {
    expect(matchPatternInLinearTime(pattern, flags, value)).toBe(expected);
    expect(native(pattern, flags, value)).toBe(expected);
  });

  test("treats a no-break space and other Unicode spaces as \\s, as the browser does", () => {
    for (const space of ["\u00a0", "\u2007", "\u202f", "\u3000", "\ufeff", "\u000b"]) {
      expect(matchPatternInLinearTime(String.raw`^\d{3}\s\d{3}$`, undefined, `123${space}456`)).toBe(true);
      expect(matchPatternInLinearTime(String.raw`^[\s]+$`, undefined, space)).toBe(true);
      expect(matchPatternInLinearTime(String.raw`^[^\s]+$`, undefined, space)).toBe(false);
    }
  });

  test("leaves an escaped backslash followed by s alone", () => {
    expect(matchPatternInLinearTime(String.raw`^\\s$`, undefined, String.raw`\s`)).toBe(true);
    expect(matchPatternInLinearTime(String.raw`^\\s$`, undefined, " ")).toBe(false);
  });

  test.each([
    ["(?=a)a", "lookahead"],
    ["(?!a)b", "negative lookahead"],
    ["(a)\\1", "backreference"],
    ["[invalid", "invalid pattern"],
    ["a", "q"],
  ])("returns undefined for %s (%s)", (pattern, flagsOrLabel) => {
    const flags = flagsOrLabel === "q" ? "q" : undefined;
    expect(matchPatternInLinearTime(pattern, flags, "a")).toBeUndefined();
  });

  test("agrees with RegExp on printable ASCII answers", () => {
    const asciiAnswer = fc.string({
      unit: fc.constantFrom(..."aAzZ019 -_.@+,;\t\\".split("")),
      maxLength: 16,
    });
    fc.assert(
      fc.property(fc.constantFrom(...COMMON_PATTERNS), asciiAnswer, ([pattern, flags], value) => {
        expect(matchPatternInLinearTime(pattern, flags, value)).toBe(native(pattern, flags, value));
      }),
      { numRuns: 2000 }
    );
  });

  // The server must never refuse an answer the respondent's browser accepted.
  test("never refuses an answer RegExp accepts, whatever the characters", () => {
    const anyAnswer = fc.string({
      unit: fc.constantFrom(
        ..."aA1 \t\n\r\u000b\u00a0\u2028\u2029\u3000\ufeff\u00e9\u017f\u212a-.".split(""),
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
          expect(matchPatternInLinearTime(pattern, flags, value)).toBe(true);
        }
      }),
      { numRuns: 3000 }
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
    const started = performance.now();

    const errors = validateBlockResponses([element], { q1: `${"a".repeat(4095)}!` }, "default", {
      matchPattern: matchPatternInLinearTime,
    });

    expect(errors.q1?.[0]?.ruleType).toBe("pattern");
    expect(performance.now() - started).toBeLessThan(1000);
  });

  test("accepts a matching answer", () => {
    expect(
      validateBlockResponses([element], { q1: "a".repeat(4096) }, "default", {
        matchPattern: matchPatternInLinearTime,
      })
    ).toEqual({});
  });
});
