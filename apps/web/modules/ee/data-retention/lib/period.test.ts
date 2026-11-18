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

  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects %d", (value) => {
    expect(() => retentionPeriodToDays({ amount: value, unit: "days" })).toThrow(RangeError);
    expect(() => daysToRetentionPeriod(value)).toThrow(RangeError);
  });

  test("stored days are always whole: a fractional day count is refused", () => {
    expect(() => daysToRetentionPeriod(1.5)).toThrow(RangeError);
  });

  // ENG-7038: a decimal amount is the nearest whole day.
  test.each([
    [{ amount: 2.5, unit: "years" }, 913],
    [{ amount: 1.5, unit: "months" }, 45],
    [{ amount: 20.5, unit: "days" }, 21],
    [{ amount: 20.4, unit: "days" }, 20],
    [{ amount: 0.001, unit: "years" }, 0],
  ] as const)("%o is %i days", (period, days) => {
    expect(retentionPeriodToDays(period)).toBe(days);
  });

  // What no unit divides reads in years to two decimals from a year up, in days below.
  test.each([
    [913, { amount: 2.5, unit: "years" }],
    [403, { amount: 1.1, unit: "years" }],
    [366, { amount: 1, unit: "years" }],
    [364, { amount: 364, unit: "days" }],
    [45, { amount: 45, unit: "days" }],
    [3649, { amount: 10, unit: "years" }],
  ] as const)("%i days reads as %o", (days, period) => {
    expect(daysToRetentionPeriod(days)).toEqual(period);
  });
});
