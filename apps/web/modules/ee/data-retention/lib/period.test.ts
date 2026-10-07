import { describe, expect, test } from "vitest";
import { daysToRetentionPeriod, retentionPeriodToDays } from "./period";

describe("retention periods", () => {
  test.each([
    [{ amount: 3, unit: "years" }, 1095],
    [{ amount: 18, unit: "months" }, 540],
    [{ amount: 45, unit: "days" }, 45],
  ] as const)("%o round-trips through %i days", (period, days) => {
    expect(retentionPeriodToDays(period)).toBe(days);
    expect(daysToRetentionPeriod(days)).toEqual(period);
  });

  test("a year is 365 days and a month 30", () => {
    expect(retentionPeriodToDays({ amount: 1, unit: "years" })).toBe(365);
    expect(retentionPeriodToDays({ amount: 12, unit: "months" })).toBe(360);
  });

  test("12 months stays 12 months rather than becoming a year", () => {
    expect(daysToRetentionPeriod(360)).toEqual({ amount: 12, unit: "months" });
  });

  test("a day count that is whole in both units comes back in years", () => {
    expect(daysToRetentionPeriod(retentionPeriodToDays({ amount: 73, unit: "months" }))).toEqual({
      amount: 6,
      unit: "years",
    });
  });

  test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects %d", (value) => {
    expect(() => retentionPeriodToDays({ amount: value, unit: "days" })).toThrow(RangeError);
    expect(() => daysToRetentionPeriod(value)).toThrow(RangeError);
  });
});
