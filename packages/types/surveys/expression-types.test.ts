import { describe, expect, test } from "vitest";
import { isDateLiteral } from "./expression-types";

describe("isDateLiteral", () => {
  // What the single pattern it replaced accepted: a day, then optionally a time with optional seconds
  // (and up to three decimals) and an optional `Z` or `±hh:mm` offset.
  const cases: [string, boolean][] = [
    ["2026-03-01", true],
    ["2026-03-01T10:00", true],
    ["2026-03-01T10:00:30", true],
    ["2026-03-01T10:00:30.1", true],
    ["2026-03-01T10:00:30.123Z", true],
    ["2026-03-01T10:00Z", true],
    ["2026-03-01T10:00+02:00", true],
    ["2026-03-01T10:00:30-05:30", true],
    ["", false],
    ["2026-3-01", false],
    ["2026-03-01 10:00", false],
    ["2026-03-01T10", false],
    ["2026-03-01T10:00:30.1234", false],
    ["2026-03-01T10:00:30.Z", false],
    ["2026-03-01Z", false],
    ["2026-03-01T10:00+0200", false],
    ["2026-03-01T10:00Zx", false],
    ["x2026-03-01", false],
    ["next week", false],
  ];

  test.each(cases)("%j is a date literal: %s", (value, expected) => {
    expect(isDateLiteral(value)).toBe(expected);
  });
});
