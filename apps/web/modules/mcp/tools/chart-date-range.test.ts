import { afterEach, describe, expect, test, vi } from "vitest";
import {
  MAX_RELATIVE_CHART_RANGE_DAYS,
  ZMcpRelativeChartDateRange,
  relativeChartRangeDays,
  resolveMcpChartDateRange,
  resolveRelativeChartDateRange,
} from "./chart-date-range";
import { ZMcpChartDateRange } from "./dashboard-schemas";

const { calendarDayReads } = vi.hoisted(() => ({
  calendarDayReads: [] as { instant: Date; timeZone: string }[],
}));

// A plain wrapper, not a vi.fn: the global vitest setup resets mocks before every test, which would
// wipe a factory-installed implementation and leave the helper composing `undefined` days.
vi.mock("@/lib/date-ranges", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/date-ranges")>();
  return {
    ...actual,
    getCalendarDayInTimeZone: (instant: Date, timeZone: string) => {
      calendarDayReads.push({ instant, timeZone });
      return actual.getCalendarDayInTimeZone(instant, timeZone);
    },
  };
});

const NOW = new Date("2026-11-24T12:00:00.000Z");

describe("relative chart date ranges", () => {
  test("a day window is today plus the days before it, both ends included", () => {
    expect(resolveRelativeChartDateRange({ last: 7, unit: "day" }, NOW)).toEqual({
      from: "2026-11-18",
      to: "2026-11-24",
    });
    expect(resolveRelativeChartDateRange({ last: 1, unit: "day" }, NOW)).toEqual({
      from: "2026-11-24",
      to: "2026-11-24",
    });
  });

  test("anchors today to the UTC date, not the runner's local day", () => {
    // 02:00 UTC is still 24 November in Los Angeles, so a local-day anchor would resolve the 24th.
    const instant = new Date("2026-11-25T02:00:00.000Z");
    calendarDayReads.length = 0;

    expect(resolveRelativeChartDateRange({ last: 1, unit: "day" }, instant)).toEqual({
      from: "2026-11-25",
      to: "2026-11-25",
    });
    expect(calendarDayReads).toEqual([{ instant, timeZone: "UTC" }]);
  });

  test("a week window is last * 7 days ending today", () => {
    expect(resolveRelativeChartDateRange({ last: 8, unit: "week" }, NOW)).toEqual({
      from: "2026-09-30",
      to: "2026-11-24",
    });
    expect(relativeChartRangeDays({ last: 8, unit: "week" }, NOW)).toBe(56);
  });

  test("a month window subtracts calendar months and clamps the day-of-month", () => {
    expect(resolveRelativeChartDateRange({ last: 3, unit: "month" }, NOW)).toEqual({
      from: "2026-08-24",
      to: "2026-11-24",
    });
    expect(
      resolveRelativeChartDateRange({ last: 3, unit: "month" }, new Date("2026-05-31T12:00:00.000Z"))
    ).toEqual({ from: "2026-02-28", to: "2026-05-31" });
    expect(
      resolveRelativeChartDateRange({ last: 1, unit: "month" }, new Date("2028-03-31T12:00:00.000Z"))
    ).toEqual({ from: "2028-02-29", to: "2028-03-31" });
  });

  test("presets and explicit ranges pass through as the tools already sent them", () => {
    expect(resolveMcpChartDateRange("last 7 days", NOW)).toEqual({
      bodyDateRange: "last 7 days",
      query: { dateRange: "last 7 days" },
    });
    expect(resolveMcpChartDateRange({ from: "2026-01-01", to: "2026-01-31" }, NOW)).toEqual({
      bodyDateRange: { from: "2026-01-01", to: "2026-01-31" },
      query: { from: "2026-01-01", to: "2026-01-31" },
    });
    expect(resolveMcpChartDateRange(undefined, NOW)).toEqual({ bodyDateRange: undefined, query: {} });
  });

  test("a relative range resolves to the same inclusive days in the preview body and the query", () => {
    expect(resolveMcpChartDateRange({ last: 8, unit: "week" }, NOW)).toEqual({
      bodyDateRange: { from: "2026-09-30", to: "2026-11-24" },
      query: { from: "2026-09-30", to: "2026-11-24" },
    });
  });
});

describe("the 365-day cap", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("counts both ends and allows exactly 365 days", () => {
    expect(MAX_RELATIVE_CHART_RANGE_DAYS).toBe(365);
    expect(relativeChartRangeDays({ last: 365, unit: "day" }, NOW)).toBe(365);
    expect(relativeChartRangeDays({ last: 52, unit: "week" }, NOW)).toBe(364);
    expect(relativeChartRangeDays({ last: 11, unit: "month" }, NOW)).toBe(336);
  });

  test("rejects a week or month window that resolves past the cap", () => {
    vi.useFakeTimers({ now: NOW });

    expect(ZMcpRelativeChartDateRange.safeParse({ last: 365, unit: "day" }).success).toBe(true);
    expect(ZMcpRelativeChartDateRange.safeParse({ last: 52, unit: "week" }).success).toBe(true);
    expect(ZMcpRelativeChartDateRange.safeParse({ last: 53, unit: "week" }).success).toBe(false);
    expect(ZMcpRelativeChartDateRange.safeParse({ last: 11, unit: "month" }).success).toBe(true);
    expect(ZMcpRelativeChartDateRange.safeParse({ last: 12, unit: "month" }).success).toBe(false);
    expect(ZMcpRelativeChartDateRange.safeParse({ last: 13, unit: "month" }).success).toBe(false);
  });

  test("refuses last outside 1..365, a fractional count, an unknown unit or an extra key", () => {
    for (const range of [
      { last: 0, unit: "day" },
      { last: 366, unit: "day" },
      { last: 1.5, unit: "day" },
      { last: 1, unit: "hour" },
      { last: 1, unit: "day", from: "2026-01-01" },
    ]) {
      expect(ZMcpRelativeChartDateRange.safeParse(range).success, JSON.stringify(range)).toBe(false);
    }
  });

  test("keeps the presets and the explicit pair accepted by the tool schema", () => {
    expect(ZMcpChartDateRange.safeParse("last 7 days").success).toBe(true);
    expect(ZMcpChartDateRange.safeParse("all-time").success).toBe(true);
    expect(ZMcpChartDateRange.safeParse({ from: "2026-01-01", to: "2026-01-31" }).success).toBe(true);
    expect(ZMcpChartDateRange.safeParse({ last: 8, unit: "week" }).success).toBe(true);
    expect(ZMcpChartDateRange.safeParse({ last: 53, unit: "week" }).success).toBe(false);
  });
});
