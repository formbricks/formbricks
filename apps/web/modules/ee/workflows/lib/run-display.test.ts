import { describe, expect, test } from "vitest";
import { MAX_RUN_JSON_CHARS, formatStepDuration, hasKeys, stringifyRunJson } from "./run-display";

describe("formatStepDuration", () => {
  test("returns null when startedAt is missing", () => {
    expect(formatStepDuration(null, "2026-06-12T10:00:01.000Z")).toBeNull();
  });

  test("returns null when finishedAt is missing", () => {
    expect(formatStepDuration("2026-06-12T10:00:00.000Z", null)).toBeNull();
  });

  test("returns null when both timestamps are missing", () => {
    expect(formatStepDuration(null, null)).toBeNull();
  });

  test("returns null for unparseable dates (NaN elapsed)", () => {
    expect(formatStepDuration("not-a-date", "also-not-a-date")).toBeNull();
  });

  test("returns null when finishedAt precedes startedAt (negative elapsed)", () => {
    expect(formatStepDuration("2026-06-12T10:00:05.000Z", "2026-06-12T10:00:00.000Z")).toBeNull();
  });

  test("formats sub-second durations in milliseconds", () => {
    expect(formatStepDuration("2026-06-12T10:00:00.000Z", "2026-06-12T10:00:00.250Z")).toBe("250ms");
  });

  test("formats the zero-elapsed boundary as 0ms", () => {
    expect(formatStepDuration("2026-06-12T10:00:00.000Z", "2026-06-12T10:00:00.000Z")).toBe("0ms");
  });

  test("formats one-second-and-over durations in seconds with one decimal", () => {
    expect(formatStepDuration("2026-06-12T10:00:00.000Z", "2026-06-12T10:00:01.500Z")).toBe("1.5s");
  });
});

describe("hasKeys", () => {
  test("is false for an empty object", () => {
    expect(hasKeys({})).toBe(false);
  });

  test("is true for a non-empty object", () => {
    expect(hasKeys({ a: 1 })).toBe(true);
  });
});

describe("stringifyRunJson", () => {
  test("pretty-prints a value that fits under the cap", () => {
    expect(stringifyRunJson({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  test("truncates an oversized payload to roughly the cap and notes the true length", () => {
    const big = { blob: "x".repeat(MAX_RUN_JSON_CHARS * 2) };
    const full = JSON.stringify(big, null, 2);
    const out = stringifyRunJson(big);
    // Bounded well under the full payload — the whole point of the cap.
    expect(out.length).toBeLessThan(full.length);
    expect(out.length).toBeLessThan(MAX_RUN_JSON_CHARS + 100);
    expect(out).toContain("truncated");
    expect(out).toContain(String(full.length));
  });

  test("respects a custom maxChars and notes the true length", () => {
    const out = stringifyRunJson({ value: "abcdefghij" }, 5);
    expect(out.startsWith('{\n  "')).toBe(true);
    expect(out).toContain("truncated");
  });

  test("falls back to String() when JSON.stringify yields undefined", () => {
    expect(stringifyRunJson(undefined)).toBe("undefined");
  });
});
