import { describe, expect, test } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";
import {
  ALL_TIME_VALUE,
  CUSTOM_VALUE,
  DATE_FILTER_FROM_PARAM,
  DATE_FILTER_PARAM,
  DATE_FILTER_TO_PARAM,
  type TDashboardDateFilter,
  applyDashboardDateFilter,
  deserializeStoredDateFilter,
  isDashboardDefaultDateRange,
  parseDashboardDateFilter,
  parseStoredDefaultDateRange,
  resolveEffectiveDateFilter,
  toChartDateRange,
  toDateRangeRule,
} from "./dashboard-date-filter";

const COLLECTED_AT = "FeedbackRecords.collectedAt";

// A fixed clock: 3 November 2026, midday UTC, so "last 30 days" is 2026-10-05 … 2026-11-03.
const CLOCK = { timeZone: "UTC", now: new Date("2026-11-03T12:00:00Z") };
const LAST_12_MONTHS: TDashboardDateFilter = { type: "custom", range: ["2025-11-04", "2026-11-03"] };

const savedOn = (dateRange?: string | [string, string]): TChartQuery => ({
  measures: ["FeedbackRecords.count"],
  timeDimensions: [{ dimension: COLLECTED_AT, granularity: "day", ...(dateRange ? { dateRange } : {}) }],
});

describe("applyDashboardDateFilter", () => {
  test("returns the query unchanged when no filter is active", () => {
    const query: TChartQuery = { measures: ["FeedbackRecords.count"] };
    expect(applyDashboardDateFilter(query, null)).toBe(query);
  });

  test("the requested range replaces the saved one, whether it is wider or narrower", () => {
    const wider = applyDashboardDateFilter(savedOn("last 30 days"), LAST_12_MONTHS);
    expect(wider.timeDimensions).toEqual([
      { dimension: COLLECTED_AT, granularity: "day", dateRange: ["2025-11-04", "2026-11-03"] },
    ]);
    const narrower = applyDashboardDateFilter(savedOn(["2026-01-01", "2026-12-31"]), {
      type: "custom",
      range: ["2026-03-01", "2026-03-31"],
    });
    expect(narrower.timeDimensions?.[0].dateRange).toEqual(["2026-03-01", "2026-03-31"]);
  });

  test("a range that does not overlap the saved one is still asked for", () => {
    const result = applyDashboardDateFilter(savedOn("last 30 days"), { type: "preset", value: "last year" });
    expect(result.timeDimensions?.[0].dateRange).toBe("last year");
  });

  test("saved all time + requested last 7 days takes the last 7 days, keeping the granularity", () => {
    const result = applyDashboardDateFilter(savedOn(), { type: "preset", value: "last 7 days" });
    expect(result.timeDimensions).toEqual([
      { dimension: COLLECTED_AT, granularity: "day", dateRange: "last 7 days" },
    ]);
  });

  test("a sub-day preset is passed on as it is", () => {
    const result = applyDashboardDateFilter(savedOn("last 30 days"), {
      type: "preset",
      value: "last 24 hours",
    });
    expect(result.timeDimensions?.[0].dateRange).toBe("last 24 hours");
  });

  test("all time drops the saved range of a chart not grouped by time", () => {
    const query: TChartQuery = {
      measures: ["FeedbackRecords.count"],
      timeDimensions: [{ dimension: COLLECTED_AT, dateRange: "last 30 days" }],
    };
    expect(applyDashboardDateFilter(query, { type: "all-time" }).timeDimensions).toEqual([]);
  });

  test("all time keeps the saved range of a chart grouped by time", () => {
    const query = savedOn("last 30 days");
    expect(applyDashboardDateFilter(query, { type: "all-time" })).toBe(query);
  });

  test("all time leaves other time dimensions and a chart with no saved range alone", () => {
    const query: TChartQuery = {
      measures: ["FeedbackRecords.count"],
      timeDimensions: [{ dimension: "FeedbackRecords.createdAt", dateRange: "last 7 days" }],
    };
    expect(applyDashboardDateFilter(query, { type: "all-time" })).toBe(query);
  });

  test("appends a filter-only time dimension when the chart has no collectedAt", () => {
    const query: TChartQuery = {
      measures: ["FeedbackRecords.count"],
      timeDimensions: [{ dimension: "FeedbackRecords.createdAt", granularity: "week" }],
    };
    const result = applyDashboardDateFilter(query, { type: "preset", value: "last 7 days" });
    expect(result.timeDimensions).toEqual([
      { dimension: "FeedbackRecords.createdAt", granularity: "week" },
      { dimension: COLLECTED_AT, dateRange: "last 7 days" },
    ]);
  });

  test("does not mutate the input query", () => {
    const query = savedOn("last 30 days");
    const before = JSON.stringify(query);
    applyDashboardDateFilter(query, { type: "preset", value: "last 7 days" });
    applyDashboardDateFilter(query, { type: "all-time" });
    expect(JSON.stringify(query)).toBe(before);
  });
});

describe("toDateRangeRule", () => {
  test("writes a preset out as the days it covers", () => {
    expect(toDateRangeRule(COLLECTED_AT, "last 7 days", CLOCK)).toEqual({
      member: COLLECTED_AT,
      operator: "inDateRange",
      values: ["2026-10-28", "2026-11-03"],
    });
  });

  test("passes a pair and a relative range only Cube reads through", () => {
    expect(toDateRangeRule(COLLECTED_AT, ["2026-01-01", "2026-01-31"], CLOCK).values).toEqual([
      "2026-01-01",
      "2026-01-31",
    ]);
    expect(toDateRangeRule(COLLECTED_AT, "last 3 months", CLOCK).values).toEqual(["last 3 months"]);
  });
});

describe("parseDashboardDateFilter", () => {
  test("returns null when the param is absent", () => {
    expect(parseDashboardDateFilter({})).toBeNull();
  });

  test("parses the all-time value", () => {
    expect(parseDashboardDateFilter({ [DATE_FILTER_PARAM]: ALL_TIME_VALUE })).toEqual({
      type: "all-time",
    });
  });

  test("parses a known preset", () => {
    expect(parseDashboardDateFilter({ [DATE_FILTER_PARAM]: "last 7 days" })).toEqual({
      type: "preset",
      value: "last 7 days",
    });
  });

  test("rejects an unknown preset", () => {
    expect(parseDashboardDateFilter({ [DATE_FILTER_PARAM]: "since forever" })).toBeNull();
  });

  test("parses a valid custom range", () => {
    expect(
      parseDashboardDateFilter({
        [DATE_FILTER_PARAM]: CUSTOM_VALUE,
        [DATE_FILTER_FROM_PARAM]: "2026-01-01",
        [DATE_FILTER_TO_PARAM]: "2026-01-31",
      })
    ).toEqual({ type: "custom", range: ["2026-01-01", "2026-01-31"] });
  });

  test("rejects a custom range missing bounds", () => {
    expect(
      parseDashboardDateFilter({ [DATE_FILTER_PARAM]: CUSTOM_VALUE, [DATE_FILTER_FROM_PARAM]: "2026-01-01" })
    ).toBeNull();
  });

  test("rejects a custom range with malformed dates", () => {
    expect(
      parseDashboardDateFilter({
        [DATE_FILTER_PARAM]: CUSTOM_VALUE,
        [DATE_FILTER_FROM_PARAM]: "01/01/2026",
        [DATE_FILTER_TO_PARAM]: "2026-01-31",
      })
    ).toBeNull();
  });

  test("handles array-valued params by taking the first entry", () => {
    expect(parseDashboardDateFilter({ [DATE_FILTER_PARAM]: ["last 7 days", "last 30 days"] })).toEqual({
      type: "preset",
      value: "last 7 days",
    });
  });

  test("rejects a custom range with an impossible calendar date", () => {
    expect(
      parseDashboardDateFilter({
        [DATE_FILTER_PARAM]: CUSTOM_VALUE,
        [DATE_FILTER_FROM_PARAM]: "2026-02-30",
        [DATE_FILTER_TO_PARAM]: "2026-03-01",
      })
    ).toBeNull();
  });

  test("rejects a custom range where from is after to", () => {
    expect(
      parseDashboardDateFilter({
        [DATE_FILTER_PARAM]: CUSTOM_VALUE,
        [DATE_FILTER_FROM_PARAM]: "2026-01-31",
        [DATE_FILTER_TO_PARAM]: "2026-01-01",
      })
    ).toBeNull();
  });

  test("accepts a custom range with equal from and to", () => {
    expect(
      parseDashboardDateFilter({
        [DATE_FILTER_PARAM]: CUSTOM_VALUE,
        [DATE_FILTER_FROM_PARAM]: "2026-01-15",
        [DATE_FILTER_TO_PARAM]: "2026-01-15",
      })
    ).toEqual({ type: "custom", range: ["2026-01-15", "2026-01-15"] });
  });
});

describe("deserializeStoredDateFilter", () => {
  test("returns null for null, empty, or malformed JSON", () => {
    expect(deserializeStoredDateFilter(null)).toBeNull();
    expect(deserializeStoredDateFilter("")).toBeNull();
    expect(deserializeStoredDateFilter("{not json")).toBeNull();
    expect(deserializeStoredDateFilter('"a string"')).toBeNull();
    expect(deserializeStoredDateFilter("42")).toBeNull();
  });

  test("parses an all-time filter", () => {
    expect(deserializeStoredDateFilter(JSON.stringify({ type: "all-time" }))).toEqual({
      type: "all-time",
    });
  });

  test("parses a valid preset and rejects an unknown one", () => {
    expect(deserializeStoredDateFilter(JSON.stringify({ type: "preset", value: "last 7 days" }))).toEqual({
      type: "preset",
      value: "last 7 days",
    });
    expect(deserializeStoredDateFilter(JSON.stringify({ type: "preset", value: "last 3 eons" }))).toBeNull();
  });

  test("parses a valid custom range and rejects malformed dates", () => {
    expect(
      deserializeStoredDateFilter(JSON.stringify({ type: "custom", range: ["2026-01-01", "2026-01-31"] }))
    ).toEqual({ type: "custom", range: ["2026-01-01", "2026-01-31"] });
    expect(
      deserializeStoredDateFilter(JSON.stringify({ type: "custom", range: ["2026/01/01", "2026-01-31"] }))
    ).toBeNull();
    expect(deserializeStoredDateFilter(JSON.stringify({ type: "custom", range: ["2026-01-01"] }))).toBeNull();
  });

  test("rejects an unknown filter type", () => {
    expect(deserializeStoredDateFilter(JSON.stringify({ type: "rolling", value: "x" }))).toBeNull();
  });

  test("rejects an impossible calendar date", () => {
    expect(
      deserializeStoredDateFilter(JSON.stringify({ type: "custom", range: ["2026-02-30", "2026-03-01"] }))
    ).toBeNull();
  });

  test("rejects an inverted range", () => {
    expect(
      deserializeStoredDateFilter(JSON.stringify({ type: "custom", range: ["2026-01-31", "2026-01-01"] }))
    ).toBeNull();
  });
});

describe("toChartDateRange", () => {
  test("hands the chart data API the dashboard filter in its own shape", () => {
    expect(toChartDateRange(null)).toBeNull();
    expect(toChartDateRange({ type: "all-time" })).toBe("all-time");
    expect(toChartDateRange({ type: "preset", value: "last 7 days" })).toBe("last 7 days");
    expect(toChartDateRange({ type: "custom", range: ["2026-01-01", "2026-01-31"] })).toEqual({
      from: "2026-01-01",
      to: "2026-01-31",
    });
  });
});

describe("dashboard default date range", () => {
  test("is a rolling preset — never all time or a custom range", () => {
    expect(isDashboardDefaultDateRange("last 30 days")).toBe(true);
    expect(isDashboardDefaultDateRange("last 8 weeks")).toBe(true);
    expect(isDashboardDefaultDateRange("last 12 months")).toBe(true);
    expect(isDashboardDefaultDateRange(ALL_TIME_VALUE)).toBe(false);
    expect(isDashboardDefaultDateRange(CUSTOM_VALUE)).toBe(false);
    expect(isDashboardDefaultDateRange(["2026-01-01", "2026-01-31"])).toBe(false);
    expect(isDashboardDefaultDateRange(null)).toBe(false);
  });

  test("a stored name that is no longer a preset reads as no default", () => {
    expect(parseStoredDefaultDateRange("last 14 days")).toBe("last 14 days");
    expect(parseStoredDefaultDateRange("last fortnight")).toBeNull();
    expect(parseStoredDefaultDateRange(null)).toBeNull();
    expect(parseStoredDefaultDateRange(undefined)).toBeNull();
  });

  test("the URL wins over everything, so ?dateRange=all time lifts a default", () => {
    const urlFilter = parseDashboardDateFilter({ [DATE_FILTER_PARAM]: ALL_TIME_VALUE });
    expect(
      resolveEffectiveDateFilter({
        urlFilter,
        chosenFilter: { type: "preset", value: "last 7 days" },
        defaultDateRange: "last 30 days",
      })
    ).toEqual({ type: "all-time" });
  });

  test("the viewer's own remembered pick wins over the dashboard default", () => {
    expect(
      resolveEffectiveDateFilter({
        urlFilter: null,
        chosenFilter: { type: "custom", range: ["2026-01-01", "2026-01-31"] },
        defaultDateRange: "last 30 days",
      })
    ).toEqual({ type: "custom", range: ["2026-01-01", "2026-01-31"] });
  });

  test("with nothing picked the default applies, and without one each chart keeps its range", () => {
    expect(
      resolveEffectiveDateFilter({ urlFilter: null, chosenFilter: null, defaultDateRange: "last 4 weeks" })
    ).toEqual({ type: "preset", value: "last 4 weeks" });
    expect(
      resolveEffectiveDateFilter({ urlFilter: null, chosenFilter: null, defaultDateRange: null })
    ).toBeNull();
    expect(
      resolveEffectiveDateFilter({ urlFilter: null, chosenFilter: null, defaultDateRange: "bogus" })
    ).toBeNull();
  });

  test("the new presets parse from the URL", () => {
    for (const value of ["last 14 days", "last 60 days", "last 180 days", "last 4 weeks", "last 12 months"]) {
      expect(parseDashboardDateFilter({ [DATE_FILTER_PARAM]: value })).toEqual({ type: "preset", value });
    }
  });
});
