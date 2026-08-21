import { describe, expect, test } from "vitest";
import {
  type TDateRangePreset,
  isSubDayDateRangePreset,
  matchDateRangePreset,
  resolveDateRangePreset,
  resolveDateRangePresetBounds,
} from "./date-ranges";

// Mid-month, mid-quarter date that exercises month/quarter/year boundaries cleanly. Local time on
// purpose: these ranges describe the viewer's calendar days, and every assertion below builds its
// expected dates the same way, so the suite is timezone-invariant.
const NOW = new Date(2026, 4, 21, 14, 30, 0); // May 21, 2026 14:30 local

// The presets the survey summary filter offers, in the order it renders them.
const SUMMARY_PRESETS: readonly TDateRangePreset[] = [
  "last 7 days",
  "last 30 days",
  "this month",
  "last month",
  "this quarter",
  "last quarter",
  "last 6 months",
  "this year",
  "last year",
];

describe("resolveDateRangePreset", () => {
  test("resolves 'last 7 days' to today plus the six days before it", () => {
    expect(resolveDateRangePreset("last 7 days", NOW)).toEqual([
      new Date(2026, 4, 15),
      new Date(2026, 4, 21),
    ]);
  });

  test("normalizes casing and surrounding whitespace", () => {
    expect(resolveDateRangePreset("  Last 7 Days ", NOW)).toEqual(resolveDateRangePreset("last 7 days", NOW));
  });

  test("returns null for a string that is not a preset", () => {
    expect(resolveDateRangePreset("from -3 days to now", NOW)).toBeNull();
  });
});

describe("resolveDateRangePresetBounds", () => {
  test("'last 7 days' spans seven whole calendar days ending tonight", () => {
    expect(resolveDateRangePresetBounds("last 7 days", NOW)).toEqual({
      from: new Date(2026, 4, 15, 0, 0, 0, 0),
      to: new Date(2026, 4, 21, 23, 59, 59, 999),
    });
  });

  test("'last 30 days' spans thirty whole calendar days ending tonight", () => {
    expect(resolveDateRangePresetBounds("last 30 days", NOW)).toEqual({
      from: new Date(2026, 3, 22, 0, 0, 0, 0),
      to: new Date(2026, 4, 21, 23, 59, 59, 999),
    });
  });

  test("day-granular presets end at the last millisecond of their final day", () => {
    expect(resolveDateRangePresetBounds("last month", NOW)).toEqual({
      from: new Date(2026, 3, 1, 0, 0, 0, 0),
      to: new Date(2026, 3, 30, 23, 59, 59, 999),
    });
  });

  test("presets covering the current period stop at the end of today, not the end of the period", () => {
    expect(resolveDateRangePresetBounds("this year", NOW).to).toEqual(new Date(2026, 4, 21, 23, 59, 59, 999));
  });

  test("'last 24 hours' keeps its time of day instead of being widened to whole days", () => {
    expect(resolveDateRangePresetBounds("last 24 hours", NOW)).toEqual({
      from: new Date(2026, 4, 20, 14, 30, 0),
      to: NOW,
    });
  });
});

describe("isSubDayDateRangePreset", () => {
  test("is true only for presets carrying a time of day", () => {
    expect(isSubDayDateRangePreset("last 24 hours")).toBe(true);
    expect(isSubDayDateRangePreset("last 7 days")).toBe(false);
    expect(isSubDayDateRangePreset("from -3 days to now")).toBe(false);
  });
});

describe("matchDateRangePreset", () => {
  test("maps every summary preset's own range back to that preset", () => {
    for (const preset of SUMMARY_PRESETS) {
      const { from, to } = resolveDateRangePresetBounds(preset, NOW);
      expect(matchDateRangePreset(from, to, SUMMARY_PRESETS, NOW)).toBe(preset);
    }
  });

  test("does not claim a hand-picked range that merely has the same width", () => {
    // Seven days wide, but not the seven days ending today — this is a custom range, and labelling it
    // "Last 7 days" would misreport which window the numbers on screen cover.
    const from = new Date(2026, 0, 1, 0, 0, 0, 0);
    const to = new Date(2026, 0, 7, 23, 59, 59, 999);
    expect(matchDateRangePreset(from, to, SUMMARY_PRESETS, NOW)).toBeNull();
  });

  test("matches at day granularity, so a range picked earlier in the day still matches", () => {
    const { from } = resolveDateRangePresetBounds("last 7 days", NOW);
    const earlierToday = new Date(2026, 4, 21, 9, 15, 0);
    expect(matchDateRangePreset(from, earlierToday, SUMMARY_PRESETS, NOW)).toBe("last 7 days");
  });

  test("returns null when no preset covers the range", () => {
    expect(
      matchDateRangePreset(new Date(2026, 4, 10), new Date(2026, 4, 12), SUMMARY_PRESETS, NOW)
    ).toBeNull();
  });
});
