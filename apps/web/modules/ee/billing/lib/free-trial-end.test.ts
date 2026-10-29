import { describe, expect, test } from "vitest";
import { buildFreeTrialEndParams, getFreeTrialEndUnix, hasFreeTrialFallback } from "./free-trial-end";

describe("getFreeTrialEndUnix", () => {
  test("adds whole days in seconds to the current time, without rounding to midnight", () => {
    const nowMs = Date.UTC(2026, 9, 23, 15, 41, 2, 900);

    expect(getFreeTrialEndUnix(14, nowMs)).toBe(Math.floor(nowMs / 1000) + 14 * 86_400);
  });

  test("keeps the exact time of day across a DST change", () => {
    // Europe/Berlin leaves CEST on 2026-10-25; a calendar-day computation would shift by an hour.
    const nowMs = Date.UTC(2026, 9, 20, 13, 41, 2);

    expect(getFreeTrialEndUnix(7, nowMs) - Math.floor(nowMs / 1000)).toBe(7 * 86_400);
  });
});

describe("buildFreeTrialEndParams", () => {
  test("cancels at the exact trial end with no proration and cancels a card-less trial", () => {
    expect(buildFreeTrialEndParams(1_793_340_541)).toEqual({
      trial_end: 1_793_340_541,
      cancel_at: 1_793_340_541,
      proration_behavior: "none",
      trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
    });
  });
});

describe("hasFreeTrialFallback", () => {
  test("is true only for a trial that cancels at the exact second it ends", () => {
    expect(hasFreeTrialFallback({ status: "trialing", cancel_at: 100, trial_end: 100 })).toBe(true);
    expect(hasFreeTrialFallback({ status: "trialing", cancel_at: null, trial_end: 100 })).toBe(false);
    expect(hasFreeTrialFallback({ status: "trialing", cancel_at: 130, trial_end: 100 })).toBe(false);
    expect(hasFreeTrialFallback({ status: "active", cancel_at: 100, trial_end: 100 })).toBe(false);
    expect(hasFreeTrialFallback(null)).toBe(false);
  });
});
