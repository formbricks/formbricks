import { describe, expect, test } from "vitest";
import type { TRetentionPolicySettings } from "../types";
import {
  RETENTION_POLICY_DEFAULTS,
  getRetentionPolicyEnabledAt,
  getRetentionPolicyIssues,
  isSameRetentionPolicy,
} from "./policy-rules";

const NOW = new Date("2030-06-01T00:00:00.000Z");
const BEFORE = new Date("2030-01-01T00:00:00.000Z");

describe("getRetentionPolicyIssues", () => {
  test("accepts every default", () => {
    for (const policy of ["responses", "surveys", "members"] as const) {
      expect(getRetentionPolicyIssues(policy, RETENTION_POLICY_DEFAULTS[policy])).toEqual([]);
    }
  });

  test.each([
    ["a notice under two weeks", "responses", { warnDays: 13 }, "warnDays"],
    ["a notice over 90 days", "surveys", { warnDays: 91 }, "warnDays"],
    ["a fractional notice", "members", { warnDays: 45.5 }, "warnDays"],
    ["a period under 30 days", "responses", { periodDays: 29, warnDays: 14 }, "periodDays"],
    ["a period over 10 years", "surveys", { periodDays: 3651 }, "periodDays"],
    ["a fractional period", "members", { periodDays: 364.5 }, "periodDays"],
    ["no survey conditions", "surveys", { conditions: [] }, "conditions"],
    ["a repeated survey condition", "surveys", { conditions: ["noChange", "noChange"] }, "conditions"],
    ["conditions on another policy", "members", { conditions: ["noChange"] }, "conditions"],
    ["a notice as long as the period", "members", { warnDays: 60, periodDays: 60 }, "warnDays"],
  ] as const)("refuses %s", (_case, policy, override, field) => {
    const settings = { ...RETENTION_POLICY_DEFAULTS[policy], ...override } as TRetentionPolicySettings;

    expect(getRetentionPolicyIssues(policy, settings).map((issue) => issue.field)).toEqual([field]);
  });

  test("accepts the edges of each range and all three conditions", () => {
    expect(
      getRetentionPolicyIssues("surveys", {
        ...RETENTION_POLICY_DEFAULTS.surveys,
        warnDays: 90,
        periodDays: 3650,
        conditions: ["noResponse", "noChange", "createdBefore"],
      })
    ).toEqual([]);
    expect(
      getRetentionPolicyIssues("responses", {
        ...RETENTION_POLICY_DEFAULTS.responses,
        warnDays: 14,
        periodDays: 30,
      })
    ).toEqual([]);
  });
});

describe("getRetentionPolicyEnabledAt", () => {
  const on = { ...RETENTION_POLICY_DEFAULTS.surveys, enabled: true };
  const saved = { ...on, enabledAt: BEFORE };

  test("starts the warning when a policy is switched on, the first time or after a pause", () => {
    expect(getRetentionPolicyEnabledAt(null, on, NOW)).toEqual(NOW);
    expect(getRetentionPolicyEnabledAt({ ...saved, enabled: false }, on, NOW)).toEqual(NOW);
  });

  test.each([
    ["a shorter period", { periodDays: 365 }],
    ["a shorter notice", { warnDays: 30 }],
    ["fewer conditions", { conditions: ["noResponse"] }],
    ["different conditions", { conditions: ["noResponse", "createdBefore"] }],
  ] as const)("restarts it on %s, which could bring an action earlier", (_case, change) => {
    expect(getRetentionPolicyEnabledAt(saved, { ...on, ...change } as TRetentionPolicySettings, NOW)).toEqual(
      NOW
    );
  });

  test.each([
    ["a longer period", { periodDays: 1825 }],
    ["a longer notice", { warnDays: 90 }],
    ["the same conditions in another order", { conditions: ["noChange", "noResponse"] }],
  ] as const)("keeps it on %s", (_case, change) => {
    expect(getRetentionPolicyEnabledAt(saved, { ...on, ...change } as TRetentionPolicySettings, NOW)).toEqual(
      BEFORE
    );
  });

  test("leaves it alone while a policy is paused or being paused", () => {
    expect(getRetentionPolicyEnabledAt(saved, { ...on, enabled: false }, NOW)).toEqual(BEFORE);
    expect(getRetentionPolicyEnabledAt(null, RETENTION_POLICY_DEFAULTS.surveys, NOW)).toBeNull();
  });

  test("starts it when an active policy somehow has none", () => {
    expect(getRetentionPolicyEnabledAt({ ...saved, enabledAt: null }, on, NOW)).toEqual(NOW);
  });
});

describe("isSameRetentionPolicy", () => {
  test("compares every setting, conditions as a set", () => {
    const base = RETENTION_POLICY_DEFAULTS.surveys;
    expect(isSameRetentionPolicy(base, { ...base, conditions: ["noChange", "noResponse"] })).toBe(true);
    expect(isSameRetentionPolicy(base, { ...base, enabled: true })).toBe(false);
    expect(isSameRetentionPolicy(base, { ...base, warnDays: 61 })).toBe(false);
    expect(isSameRetentionPolicy(base, { ...base, conditions: ["noChange"] })).toBe(false);
  });
});
