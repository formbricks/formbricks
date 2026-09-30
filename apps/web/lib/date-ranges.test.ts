import { describe, expect, test } from "vitest";
import { formatLocalDay } from "@/lib/utils/datetime";
import {
  DATE_RANGE_PRESETS,
  getCalendarDayInTimeZone,
  getEndOfDayInTimeZone,
  getReportingTimeZone,
  getStartOfDayInTimeZone,
  isSubDayDateRangePreset,
  matchDateRangePreset,
  resolveCalendarDayRangeBounds,
  resolveDateRangeLabelPreset,
  resolveDateRangePreset,
  resolveDateRangePresetBounds,
} from "./date-ranges";

// Mid-month, mid-quarter instant that exercises month/quarter/year boundaries cleanly. Fixed in UTC on
// purpose: the module cuts calendar days in the zone it is handed, never in the runtime's, so every
// assertion below is independent of the machine running the suite.
const NOW = new Date("2026-05-21T14:30:00Z");
// 22:30 UTC — still May 21 in UTC and Los Angeles, already May 22 in Berlin.
const LATE_EVENING = new Date("2026-05-21T22:30:00Z");
const UTC = "UTC";
const BERLIN = "Europe/Berlin";

// A date-only value the way the module hands them out: local midnight of the runtime, of which only
// the year, month and day carry meaning.
const day = (year: number, month: number, dayOfMonth: number): Date => new Date(year, month - 1, dayOfMonth);

const CALENDAR_PRESETS = DATE_RANGE_PRESETS.filter((preset) => !isSubDayDateRangePreset(preset));

describe("getReportingTimeZone", () => {
  test("reads an unset display time zone as UTC, like the exports do", () => {
    expect(getReportingTimeZone(null)).toBe("UTC");
    expect(getReportingTimeZone(undefined)).toBe("UTC");
    expect(getReportingTimeZone("Europe/Berlin")).toBe("Europe/Berlin");
  });

  test("resolves a zone this runtime does not know to UTC, so Cube is never asked for a name the days were not cut in", () => {
    expect(getReportingTimeZone("Not/AZone")).toBe("UTC");
  });
});

describe("getCalendarDayInTimeZone", () => {
  test("reads the calendar day off the zone's wall clock, not the runtime's", () => {
    expect(getCalendarDayInTimeZone(LATE_EVENING, UTC)).toEqual(day(2026, 5, 21));
    expect(getCalendarDayInTimeZone(LATE_EVENING, "America/Los_Angeles")).toEqual(day(2026, 5, 21));
    expect(getCalendarDayInTimeZone(LATE_EVENING, BERLIN)).toEqual(day(2026, 5, 22));
  });
});

describe("getStartOfDayInTimeZone / getEndOfDayInTimeZone", () => {
  test("bound the day at the zone's midnight", () => {
    expect(getStartOfDayInTimeZone(day(2026, 5, 21), UTC)).toEqual(new Date("2026-05-21T00:00:00.000Z"));
    expect(getEndOfDayInTimeZone(day(2026, 5, 21), UTC)).toEqual(new Date("2026-05-21T23:59:59.999Z"));
    expect(getStartOfDayInTimeZone(day(2026, 5, 21), BERLIN)).toEqual(new Date("2026-05-20T22:00:00.000Z"));
    expect(getEndOfDayInTimeZone(day(2026, 5, 21), BERLIN)).toEqual(new Date("2026-05-21T21:59:59.999Z"));
  });

  test("a day that loses an hour to DST is 23 hours long, one that gains an hour is 25", () => {
    // Berlin springs forward on March 29, 2026 (CET → CEST).
    expect(getStartOfDayInTimeZone(day(2026, 3, 29), BERLIN)).toEqual(new Date("2026-03-28T23:00:00.000Z"));
    expect(getEndOfDayInTimeZone(day(2026, 3, 29), BERLIN)).toEqual(new Date("2026-03-29T21:59:59.999Z"));
    // New York falls back on November 1, 2026 (EDT → EST).
    expect(getStartOfDayInTimeZone(day(2026, 11, 1), "America/New_York")).toEqual(
      new Date("2026-11-01T04:00:00.000Z")
    );
    expect(getEndOfDayInTimeZone(day(2026, 11, 1), "America/New_York")).toEqual(
      new Date("2026-11-02T04:59:59.999Z")
    );
  });

  test("the bounds of a day read back as that day, DST switches included", () => {
    const cases: [string, Date][] = [
      [UTC, day(2026, 9, 27)],
      [BERLIN, day(2026, 3, 29)],
      ["Pacific/Auckland", day(2026, 9, 27)],
      ["America/Los_Angeles", day(2026, 11, 1)],
      ["America/Santiago", day(2026, 9, 6)],
      ["America/Havana", day(2026, 3, 8)],
      ["America/Havana", day(2026, 11, 1)],
      ["Asia/Amman", day(2021, 10, 29)],
    ];
    for (const [zone, picked] of cases) {
      expect(getCalendarDayInTimeZone(getStartOfDayInTimeZone(picked, zone), zone)).toEqual(picked);
      expect(getCalendarDayInTimeZone(getEndOfDayInTimeZone(picked, zone), zone)).toEqual(picked);
    }
  });

  test("a switch at midnight that skips 00:00 starts the day at the switch", () => {
    // Santiago springs forward at 24:00 on Sep 5, 2026: the clock goes straight from 23:59:59 to 01:00.
    expect(getStartOfDayInTimeZone(day(2026, 9, 6), "America/Santiago")).toEqual(
      new Date("2026-09-06T04:00:00.000Z")
    );
    expect(getEndOfDayInTimeZone(day(2026, 9, 5), "America/Santiago")).toEqual(
      new Date("2026-09-06T03:59:59.999Z")
    );
    // Havana does the same at 00:00 on Mar 8, 2026.
    expect(getStartOfDayInTimeZone(day(2026, 3, 8), "America/Havana")).toEqual(
      new Date("2026-03-08T05:00:00.000Z")
    );
  });

  test("a switch at midnight that repeats 00:00 starts the day at the first midnight", () => {
    // Havana falls back at 01:00 on Nov 1, 2026, so 00:00–00:59 happens twice, and the day is 25 hours.
    expect(getStartOfDayInTimeZone(day(2026, 11, 1), "America/Havana")).toEqual(
      new Date("2026-11-01T04:00:00.000Z")
    );
    expect(getEndOfDayInTimeZone(day(2026, 11, 1), "America/Havana")).toEqual(
      new Date("2026-11-02T04:59:59.999Z")
    );
    // Amman did the same east of UTC on Oct 29, 2021.
    expect(getStartOfDayInTimeZone(day(2021, 10, 29), "Asia/Amman")).toEqual(
      new Date("2021-10-28T21:00:00.000Z")
    );
    expect(getEndOfDayInTimeZone(day(2021, 10, 28), "Asia/Amman")).toEqual(
      new Date("2021-10-28T20:59:59.999Z")
    );
  });

  test("falls back to UTC for a zone name the runtime does not know", () => {
    expect(getStartOfDayInTimeZone(day(2026, 5, 21), "Not/AZone")).toEqual(
      new Date("2026-05-21T00:00:00.000Z")
    );
  });
});

describe("resolveDateRangePreset", () => {
  test("resolves 'last 7 days' to today plus the six days before it, as calendar days", () => {
    expect(resolveDateRangePreset("last 7 days", UTC, NOW)).toEqual([day(2026, 5, 15), day(2026, 5, 21)]);
  });

  test("takes 'today' from the reporting zone, where the day may already have rolled over", () => {
    expect(resolveDateRangePreset("today", UTC, LATE_EVENING)).toEqual([day(2026, 5, 21), day(2026, 5, 21)]);
    expect(resolveDateRangePreset("today", BERLIN, LATE_EVENING)).toEqual([
      day(2026, 5, 22),
      day(2026, 5, 22),
    ]);
  });

  test("closed periods end on their last calendar day", () => {
    expect(resolveDateRangePreset("last quarter", UTC, NOW)).toEqual([day(2026, 1, 1), day(2026, 3, 31)]);
    expect(resolveDateRangePreset("last year", UTC, NOW)).toEqual([day(2025, 1, 1), day(2025, 12, 31)]);
  });

  test("normalizes casing and surrounding whitespace", () => {
    expect(resolveDateRangePreset("  Last 7 Days ", UTC, NOW)).toEqual(
      resolveDateRangePreset("last 7 days", UTC, NOW)
    );
  });

  test("returns null for a string that is not a preset", () => {
    expect(resolveDateRangePreset("from -3 days to now", UTC, NOW)).toBeNull();
  });
});

describe("resolveDateRangePresetBounds", () => {
  test("'last 7 days' spans seven whole calendar days ending tonight", () => {
    expect(resolveDateRangePresetBounds("last 7 days", UTC, NOW)).toEqual({
      from: new Date("2026-05-15T00:00:00.000Z"),
      to: new Date("2026-05-21T23:59:59.999Z"),
    });
  });

  test("cuts the days at the reporting zone's midnight, not the viewer's or the server's", () => {
    expect(resolveDateRangePresetBounds("last 7 days", BERLIN, NOW)).toEqual({
      from: new Date("2026-05-14T22:00:00.000Z"),
      to: new Date("2026-05-21T21:59:59.999Z"),
    });
  });

  test("rolls over to the next day at the zone's midnight, hours before UTC does", () => {
    expect(resolveDateRangePresetBounds("today", UTC, LATE_EVENING)).toEqual({
      from: new Date("2026-05-21T00:00:00.000Z"),
      to: new Date("2026-05-21T23:59:59.999Z"),
    });
    expect(resolveDateRangePresetBounds("today", BERLIN, LATE_EVENING)).toEqual({
      from: new Date("2026-05-21T22:00:00.000Z"),
      to: new Date("2026-05-22T21:59:59.999Z"),
    });
  });

  test("'last 30 days' spans thirty whole calendar days ending tonight", () => {
    expect(resolveDateRangePresetBounds("last 30 days", UTC, NOW)).toEqual({
      from: new Date("2026-04-22T00:00:00.000Z"),
      to: new Date("2026-05-21T23:59:59.999Z"),
    });
  });

  test("calendar-day presets end at the last millisecond of their final day", () => {
    expect(resolveDateRangePresetBounds("last month", UTC, NOW)).toEqual({
      from: new Date("2026-04-01T00:00:00.000Z"),
      to: new Date("2026-04-30T23:59:59.999Z"),
    });
  });

  test("presets covering the current period stop at the end of today, not the end of the period", () => {
    expect(resolveDateRangePresetBounds("this year", UTC, NOW).to).toEqual(
      new Date("2026-05-21T23:59:59.999Z")
    );
  });

  test("'last 24 hours' keeps its time of day and ignores the zone", () => {
    const expected = { from: new Date("2026-05-20T14:30:00Z"), to: NOW };
    expect(resolveDateRangePresetBounds("last 24 hours", UTC, NOW)).toEqual(expected);
    expect(resolveDateRangePresetBounds("last 24 hours", BERLIN, NOW)).toEqual(expected);
  });
});

describe("resolveCalendarDayRangeBounds", () => {
  test("widens picked calendar days to the zone's day bounds", () => {
    expect(resolveCalendarDayRangeBounds({ from: day(2026, 5, 1), to: day(2026, 5, 7) }, BERLIN)).toEqual({
      from: new Date("2026-04-30T22:00:00.000Z"),
      to: new Date("2026-05-07T21:59:59.999Z"),
    });
  });

  test("leaves an end that is still unpicked alone", () => {
    expect(resolveCalendarDayRangeBounds({ from: day(2026, 5, 1), to: undefined }, UTC)).toEqual({
      from: new Date("2026-05-01T00:00:00.000Z"),
      to: undefined,
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
  test("maps every calendar preset's own range back to that preset", () => {
    for (const preset of CALENDAR_PRESETS) {
      const { from, to } = resolveDateRangePresetBounds(preset, BERLIN, NOW);
      expect(matchDateRangePreset(from, to, DATE_RANGE_PRESETS, BERLIN, NOW)).toBe(preset);
    }
  });

  test("does not claim a hand-picked range that merely has the same width", () => {
    // Seven days wide, but not the seven days ending today — this is a custom range, and labelling it
    // "Last 7 days" would misreport which window the numbers on screen cover.
    const from = new Date("2026-01-01T00:00:00.000Z");
    const to = new Date("2026-01-07T23:59:59.999Z");
    expect(matchDateRangePreset(from, to, DATE_RANGE_PRESETS, UTC, NOW)).toBeNull();
  });

  test("matches at day granularity in the reporting zone, so a range picked earlier in the day still matches", () => {
    const { from } = resolveDateRangePresetBounds("last 7 days", BERLIN, NOW);
    const earlierToday = new Date("2026-05-21T09:15:00Z");
    expect(matchDateRangePreset(from, earlierToday, DATE_RANGE_PRESETS, BERLIN, NOW)).toBe("last 7 days");
  });

  test("never labels two picked days 'last 24 hours': a calendar cannot pick a time of day", () => {
    const from = new Date("2026-05-20T00:00:00.000Z");
    const to = new Date("2026-05-21T23:59:59.999Z");
    expect(matchDateRangePreset(from, to, DATE_RANGE_PRESETS, UTC, NOW)).toBeNull();
  });

  test("returns null when no preset covers the range", () => {
    expect(
      matchDateRangePreset(
        new Date("2026-05-10T00:00:00Z"),
        new Date("2026-05-12T00:00:00Z"),
        DATE_RANGE_PRESETS,
        UTC,
        NOW
      )
    ).toBeNull();
  });

  test("cannot tell 'this month' and 'last 7 days' apart on the 7th of a month", () => {
    // Both presets end at the end of today by definition, so on the 7th they cover the same seven
    // calendar days. This is the collision a stored preset tag is meant to avoid resolving through
    // here at all — see `resolveDateRangeLabelPreset`.
    const onThe7th = new Date("2026-08-07T10:00:00Z");
    const { from, to } = resolveDateRangePresetBounds("this month", UTC, onThe7th);
    expect(matchDateRangePreset(from, to, DATE_RANGE_PRESETS, UTC, onThe7th)).toBe("last 7 days");
  });
});

describe("resolveDateRangeLabelPreset", () => {
  test("prefers the range's own recorded preset over reverse-matching its bounds", () => {
    // On the 7th, "this month" and "last 7 days" resolve to identical bounds (see the
    // matchDateRangePreset collision test above), so a reverse-match alone can't recover "this
    // month" here — the recorded preset is the only thing that can.
    const onThe7th = new Date("2026-08-07T10:00:00Z");
    const bounds = resolveDateRangePresetBounds("this month", UTC, onThe7th);
    expect(
      resolveDateRangeLabelPreset({ ...bounds, preset: "this month" }, DATE_RANGE_PRESETS, UTC, onThe7th)
    ).toBe("this month");
  });

  test("falls back to reverse-matching when no preset is recorded, for a hand-picked range", () => {
    const { from, to } = resolveDateRangePresetBounds("last 7 days", BERLIN, NOW);
    expect(resolveDateRangeLabelPreset({ from, to }, DATE_RANGE_PRESETS, BERLIN, NOW)).toBe("last 7 days");
  });

  test("returns null for a range with neither a recorded preset nor a bounds match", () => {
    expect(
      resolveDateRangeLabelPreset(
        { from: new Date("2026-05-10T00:00:00Z"), to: new Date("2026-05-12T00:00:00Z") },
        DATE_RANGE_PRESETS,
        UTC,
        NOW
      )
    ).toBeNull();
  });

  test("returns null when the range has no bounds at all (e.g. 'all time')", () => {
    expect(resolveDateRangeLabelPreset({}, DATE_RANGE_PRESETS, UTC, NOW)).toBeNull();
  });
});

describe("calendar days as Cube sees them", () => {
  test("a calendar preset's bounds serialize to the same days a chart sends", () => {
    for (const preset of CALENDAR_PRESETS) {
      const range = resolveDateRangePreset(preset, BERLIN, LATE_EVENING);
      if (!range) throw new Error(`${preset} did not resolve`);
      const [start, end] = range;
      const { from, to } = resolveDateRangePresetBounds(preset, BERLIN, LATE_EVENING);
      expect(formatLocalDay(getCalendarDayInTimeZone(from, BERLIN))).toBe(formatLocalDay(start));
      expect(formatLocalDay(getCalendarDayInTimeZone(to, BERLIN))).toBe(formatLocalDay(end));
    }
  });
});
