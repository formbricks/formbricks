import { describe, expect, test } from "vitest";
import { getBillingUsageCycleWindow, getMonthlyUsageCycleWindow, needsMonthlyResponseCount } from "./billing";

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

  // ENG-7024: Stripe anchors a trialing subscription at the trial end, so counting a month back from it
  // starts the window before the trial (and the org) existed.
  test("starts a trialing subscription's window at the trial start", () => {
    const result = getBillingUsageCycleWindow(
      {
        usageCycleAnchor: new Date("2026-11-23T10:00:00.000Z"),
        stripe: { subscriptionStatus: "trialing", trialStart: "2026-11-09T10:00:00.000Z" },
      },
      new Date("2026-11-17T12:00:00.000Z")
    );

    expect(result).toEqual({
      start: new Date("2026-11-09T10:00:00.000Z"),
      end: new Date("2026-11-23T10:00:00.000Z"),
    });
  });

  test("keeps the anchored window once the subscription is no longer trialing", () => {
    const result = getBillingUsageCycleWindow(
      {
        usageCycleAnchor: new Date("2026-11-23T10:00:00.000Z"),
        stripe: { subscriptionStatus: "active", trialStart: "2026-11-09T10:00:00.000Z" },
      },
      new Date("2026-11-17T12:00:00.000Z")
    );

    expect(result).toEqual({
      start: new Date("2026-10-23T10:00:00.000Z"),
      end: new Date("2026-11-23T10:00:00.000Z"),
    });
  });

  test("keeps the anchored window when the trial started before it", () => {
    const result = getBillingUsageCycleWindow(
      {
        usageCycleAnchor: new Date("2026-11-23T10:00:00.000Z"),
        stripe: { subscriptionStatus: "trialing", trialStart: "2026-10-01T10:00:00.000Z" },
      },
      new Date("2026-11-17T12:00:00.000Z")
    );

    expect(result).toEqual({
      start: new Date("2026-10-23T10:00:00.000Z"),
      end: new Date("2026-11-23T10:00:00.000Z"),
    });
  });

  test.each([
    { label: "missing", trialStart: undefined },
    { label: "null", trialStart: null },
    { label: "not a date", trialStart: "not-a-date" },
  ])("keeps the anchored window when the trial start is $label", ({ trialStart }) => {
    const result = getBillingUsageCycleWindow(
      {
        usageCycleAnchor: new Date("2026-11-23T10:00:00.000Z"),
        stripe: { subscriptionStatus: "trialing", trialStart },
      },
      new Date("2026-11-17T12:00:00.000Z")
    );

    expect(result).toEqual({
      start: new Date("2026-10-23T10:00:00.000Z"),
      end: new Date("2026-11-23T10:00:00.000Z"),
    });
  });
});

describe("needsMonthlyResponseCount", () => {
  const unlimited = { limits: { workspaces: null, monthly: { responses: null, workflowRuns: null } } };

  test("counts when the plan has a response limit, which the limits banner compares against", () => {
    expect(
      needsMonthlyResponseCount({
        limits: { workspaces: 3, monthly: { responses: 250, workflowRuns: null } },
      })
    ).toBe(true);
  });

  test("skips the count for a plan with no response limit", () => {
    expect(needsMonthlyResponseCount(unlimited)).toBe(false);
    expect(needsMonthlyResponseCount(null)).toBe(false);
  });

  // The Hobby warnings use fixed 200/250 thresholds and the trial card shows the count, whatever the limit.
  test.each([
    ["Hobby", { plan: "hobby" }],
    ["trialing", { subscriptionStatus: "trialing" }],
  ] as const)("still counts for a %s organization without a response limit", (_, stripe) => {
    expect(needsMonthlyResponseCount({ ...unlimited, stripe })).toBe(true);
  });
});
