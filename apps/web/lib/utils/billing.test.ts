import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getBillingPeriodStartDate } from "./billing";

describe("getBillingPeriodStartDate", () => {
  let originalDate: DateConstructor;

  beforeEach(() => {
    originalDate = global.Date;
  });

  afterEach(() => {
    global.Date = originalDate;
    vi.useRealTimers();
  });

  test("returns billing.periodStart when available", () => {
    const periodStart = new Date("2026-02-10T00:00:00.000Z");

    const result = getBillingPeriodStartDate({
      stripeCustomerId: "cus_123",
      periodStart,
      limits: {
        projects: 1,
        monthly: {
          responses: 250,
        },
      },
    });

    expect(result).toEqual(periodStart);
  });

  test("falls back to first day of current month when periodStart is unavailable", () => {
    vi.setSystemTime(new Date(2026, 2, 15));

    const result = getBillingPeriodStartDate({
      stripeCustomerId: null,
      periodStart: null,
      limits: {
        projects: 3,
        monthly: {
          responses: 1500,
        },
      },
    });

    expect(result).toEqual(new Date(2026, 2, 1));
  });
});
