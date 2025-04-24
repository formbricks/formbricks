import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getBillingPeriodStartDate } from "./billing";

describe("getBillingPeriodStartDate", () => {
  let originalDate: DateConstructor;

  beforeEach(() => {
    // Store the original Date constructor
    originalDate = global.Date;
  });

  afterEach(() => {
    // Restore the original Date constructor
    global.Date = originalDate;
    vi.useRealTimers();
  });

  test("returns first day of month for free plans", () => {
    // Mock the current date to be 2023-03-15
    vi.setSystemTime(new Date(2023, 2, 15));

    const organization = {
      billing: {
        plan: "free",
        periodStart: new Date("2023-01-15"),
        period: "monthly",
      },
    };

    const result = getBillingPeriodStartDate(organization.billing);

    // For free plans, should return first day of current month
    expect(result).toEqual(new Date(2023, 2, 1));
  });

  test("returns correct date for monthly plans", () => {
    // Mock the current date to be 2023-03-15
    vi.setSystemTime(new Date(2023, 2, 15));

    const organization = {
      billing: {
        plan: "scale",
        periodStart: new Date("2023-02-10"),
        period: "monthly",
      },
    };

    const result = getBillingPeriodStartDate(organization.billing);

    // For monthly plans, should return periodStart directly
    expect(result).toEqual(new Date("2023-02-10"));
  });

  test("returns current month's subscription day for yearly plans when today is after subscription day", () => {
    // Mock the current date to be March 20, 2023
    vi.setSystemTime(new Date(2023, 2, 20));

    const organization = {
      billing: {
        plan: "scale",
        periodStart: new Date("2022-05-15"), // Original subscription on 15th
        period: "yearly",
      },
    };

    const result = getBillingPeriodStartDate(organization.billing);

    // Should return March 15, 2023 (same day in current month)
    expect(result).toEqual(new Date(2023, 2, 15));
  });

  test("returns previous month's subscription day for yearly plans when today is before subscription day", () => {
    // Mock the current date to be March 10, 2023
    vi.setSystemTime(new Date(2023, 2, 10));

    const organization = {
      billing: {
        plan: "scale",
        periodStart: new Date("2022-05-15"), // Original subscription on 15th
        period: "yearly",
      },
    };

    const result = getBillingPeriodStartDate(organization.billing);

    // Should return February 15, 2023 (same day in previous month)
    expect(result).toEqual(new Date(2023, 1, 15));
  });

  test("handles subscription day that doesn't exist in current month (February edge case)", () => {
    // Mock the current date to be February 15, 2023
    vi.setSystemTime(new Date(2023, 1, 15));

    const organization = {
      billing: {
        plan: "scale",
        periodStart: new Date("2022-01-31"), // Original subscription on 31st
        period: "yearly",
      },
    };

    const result = getBillingPeriodStartDate(organization.billing);

    // Should return January 31, 2023 (previous month's subscription day)
    // since today (Feb 15) is less than the subscription day (31st)
    expect(result).toEqual(new Date(2023, 0, 31));
  });

  test("handles subscription day that doesn't exist in previous month (February to March transition)", () => {
    // Mock the current date to be March 10, 2023
    vi.setSystemTime(new Date(2023, 2, 10));

    const organization = {
      billing: {
        plan: "scale",
        periodStart: new Date("2022-01-30"), // Original subscription on 30th
        period: "yearly",
      },
    };

    const result = getBillingPeriodStartDate(organization.billing);

    // Should return February 28, 2023 (last day of February)
    // since February 2023 doesn't have a 30th day
    expect(result).toEqual(new Date(2023, 1, 28));
  });

  test("handles subscription day that doesn't exist in previous month (leap year)", () => {
    // Mock the current date to be March 10, 2024 (leap year)
    vi.setSystemTime(new Date(2024, 2, 10));

    const organization = {
      billing: {
        plan: "scale",
        periodStart: new Date("2023-01-30"), // Original subscription on 30th
        period: "yearly",
      },
    };

    const result = getBillingPeriodStartDate(organization.billing);

    // Should return February 29, 2024 (last day of February in leap year)
    expect(result).toEqual(new Date(2024, 1, 29));
  });
  test("handles current month with fewer days than subscription day", () => {
    // Mock the current date to be April 25, 2023 (April has 30 days)
    vi.setSystemTime(new Date(2023, 3, 25));

    const organization = {
      billing: {
        plan: "scale",
        periodStart: new Date("2022-01-31"), // Original subscription on 31st
        period: "yearly",
      },
    };

    const result = getBillingPeriodStartDate(organization.billing);

    // Should return March 31, 2023 (since today is before April's adjusted subscription day)
    expect(result).toEqual(new Date(2023, 2, 31));
  });

  test("throws error when periodStart is not set for non-free plans", () => {
    const organization = {
      billing: {
        plan: "scale",
        periodStart: null,
        period: "monthly",
      },
    };

    expect(() => {
      getBillingPeriodStartDate(organization.billing);
    }).toThrow("billing period start is not set");
  });
});
