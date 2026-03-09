import { describe, expect, test } from "vitest";
import { getBillingUsageCycleWindow, getMonthlyUsageCycleWindow } from "./billing";

describe("getMonthlyUsageCycleWindow", () => {
  test("derives the current monthly window from a regular anchor day", () => {
    const result = getMonthlyUsageCycleWindow(
      new Date("2026-01-15T10:30:00.000Z"),
      new Date("2026-03-09T12:00:00.000Z")
    );

    expect(result).toEqual({
      start: new Date("2026-02-15T10:30:00.000Z"),
      end: new Date("2026-03-15T10:30:00.000Z"),
    });
  });

  test("keeps monthly windows for yearly subscriptions anchored on the original day", () => {
    const result = getMonthlyUsageCycleWindow(
      new Date("2026-01-15T00:00:00.000Z"),
      new Date("2026-11-20T12:00:00.000Z")
    );

    expect(result).toEqual({
      start: new Date("2026-11-15T00:00:00.000Z"),
      end: new Date("2026-12-15T00:00:00.000Z"),
    });
  });

  test("clamps short months for anchors on the 31st", () => {
    const result = getMonthlyUsageCycleWindow(
      new Date("2026-01-31T08:00:00.000Z"),
      new Date("2026-02-28T12:00:00.000Z")
    );

    expect(result).toEqual({
      start: new Date("2026-02-28T08:00:00.000Z"),
      end: new Date("2026-03-31T08:00:00.000Z"),
    });
  });

  test("falls back to the current UTC calendar month when no anchor exists", () => {
    const result = getMonthlyUsageCycleWindow(null, new Date("2026-03-09T12:00:00.000Z"));

    expect(result).toEqual({
      start: new Date("2026-03-01T00:00:00.000Z"),
      end: new Date("2026-04-01T00:00:00.000Z"),
    });
  });
});

describe("getBillingUsageCycleWindow", () => {
  test("uses the billing usageCycleAnchor", () => {
    const result = getBillingUsageCycleWindow(
      {
        usageCycleAnchor: new Date("2026-02-10T00:00:00.000Z"),
      },
      new Date("2026-03-09T12:00:00.000Z")
    );

    expect(result).toEqual({
      start: new Date("2026-02-10T00:00:00.000Z"),
      end: new Date("2026-03-10T00:00:00.000Z"),
    });
  });
});
