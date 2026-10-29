import { describe, expect, test } from "vitest";
import {
  MAX_TIME_BUCKETS,
  countTimeBuckets,
  countTimeBucketsSpanning,
  isTimeBucketGranularity,
} from "./time-buckets";

describe("countTimeBuckets", () => {
  test.each([
    ["one calendar day by the hour", "2024-03-10", "2024-03-10", "hour", 24],
    ["a leap year by the hour", "2024-01-01", "2024-12-31", "hour", 8784],
    ["one calendar day by the minute", "2024-03-10", "2024-03-10", "minute", 1440],
    ["one calendar day by the second", "2024-03-10", "2024-03-10", "second", 86_400],
    ["a leap year by the day", "2024-01-01", "2024-12-31", "day", 366],
    ["Monday to Sunday is one ISO week", "2024-01-01", "2024-01-07", "week", 1],
    ["Sunday to Monday touches two ISO weeks", "2024-01-07", "2024-01-08", "week", 2],
    ["the last day of a month and the first of the next", "2024-01-31", "2024-02-01", "month", 2],
    ["a full year by the month", "2024-01-01", "2024-12-31", "month", 12],
    ["across a quarter boundary", "2024-03-31", "2024-04-01", "quarter", 2],
    ["a full year by the quarter", "2024-01-01", "2024-12-31", "quarter", 4],
    ["across a year boundary", "2023-12-31", "2024-01-01", "year", 2],
  ] as const)("%s", (_label, from, to, granularity, expected) => {
    expect(countTimeBuckets(from, to, granularity)).toBe(expected);
  });

  test("reads Cube's date-times without an offset as UTC", () => {
    expect(countTimeBuckets("2024-01-01T00:00:00.000", "2024-01-02T23:59:59.999", "hour")).toBe(48);
    expect(countTimeBuckets("2024-01-01T10:30:00.000", "2024-01-01T11:00:00.000", "hour")).toBe(2);
  });

  test("honours an explicit offset", () => {
    expect(countTimeBuckets("2024-01-01T00:00:00+02:00", "2024-01-01T00:59:59+02:00", "hour")).toBe(1);
  });

  test("counts a range across centuries without building it", () => {
    expect(countTimeBuckets("0100-01-01", "9999-12-31", "hour")).toBeGreaterThan(86_000_000);
  });

  test("an inverted range has no buckets", () => {
    expect(countTimeBuckets("2024-02-01", "2024-01-01", "day")).toBe(0);
  });

  test("an unreadable bound counts as unlimited, so a cap never lets it through", () => {
    expect(countTimeBuckets("not-a-date", "2024-01-01", "day")).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("MAX_TIME_BUCKETS", () => {
  test("holds a leap year by the hour, the widest range the app's presets reach at the finest granularity", () => {
    expect(countTimeBuckets("2024-01-01", "2024-12-31", "hour")).toBeLessThanOrEqual(MAX_TIME_BUCKETS);
  });
});

describe("isTimeBucketGranularity", () => {
  test("knows Cube's built-in granularities and nothing else", () => {
    for (const granularity of ["second", "minute", "hour", "day", "week", "month", "quarter", "year"]) {
      expect(isTimeBucketGranularity(granularity)).toBe(true);
    }
    expect(isTimeBucketGranularity("fiscal_year")).toBe(false);
  });
});

describe("countTimeBucketsSpanning", () => {
  test("spans the earliest to the latest value, in any order", () => {
    expect(
      countTimeBucketsSpanning(
        ["2024-01-02T00:00:00.000", "2024-01-01T00:00:00.000", "2024-01-01T12:00:00.000"],
        "hour"
      )
    ).toBe(25);
  });

  test("compares instants, not strings, so an extended year cannot sort itself out of the span", () => {
    // As strings, "+010000-…" sorts before "2024-…" and the span would read as empty.
    expect(countTimeBucketsSpanning(["2024-01-01T00:00:00.000", "+010000-01-01T00:00:00.000"], "month")).toBe(
      (10_000 - 2024) * 12 + 1
    );
  });

  test("skips empty values, as the Cube client does, and has no buckets without a value", () => {
    expect(countTimeBucketsSpanning([null, "", undefined, "2024-01-01T05:00:00.000"], "hour")).toBe(1);
    expect(countTimeBucketsSpanning([], "day")).toBe(0);
  });

  test("an unreadable value counts as unlimited", () => {
    expect(countTimeBucketsSpanning(["2024-01-01T00:00:00.000", "soon"], "day")).toBe(
      Number.POSITIVE_INFINITY
    );
    expect(countTimeBucketsSpanning([1_700_000_000_000], "day")).toBe(Number.POSITIVE_INFINITY);
  });
});
