import { afterEach, describe, expect, test, vi } from "vitest";
import { getTrialDaysRemaining } from "./trial-countdown";

describe("getTrialDaysRemaining", () => {
  const now = new Date("2026-01-10T12:00:00.000Z");

  afterEach(() => {
    vi.useRealTimers();
  });

  const freezeClock = () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  };

  test("rounds a partial day up so the last hours still read as a full day", () => {
    freezeClock();

    // 30 minutes left is still "1 day", not 0 — the count is what the trial banner shows.
    expect(getTrialDaysRemaining(new Date("2026-01-10T12:30:00.000Z"))).toBe(1);
  });

  test("counts whole days ahead", () => {
    freezeClock();

    expect(getTrialDaysRemaining(new Date("2026-01-13T12:00:00.000Z"))).toBe(3);
  });

  test("accepts an ISO string as well as a Date", () => {
    freezeClock();

    expect(getTrialDaysRemaining("2026-01-13T12:00:00.000Z")).toBe(3);
  });

  test("goes non-positive once the trial has ended", () => {
    freezeClock();

    expect(getTrialDaysRemaining(new Date("2026-01-09T12:00:00.000Z"))).toBe(-1);
  });

  test("returns null for an unparseable date rather than NaN", () => {
    freezeClock();

    // A NaN here would reach the banner as "NaN days left"; null lets callers hide it instead.
    expect(getTrialDaysRemaining("not-a-date")).toBeNull();
  });
});
