import { describe, expect, test } from "vitest";
import { type TRetentionHealthFacts, getRetentionHealthIssues } from "./health";

const NOW = new Date("2030-06-10T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 60 * 60 * 1000);

const healthy: TRetentionHealthFacts = {
  jobsConfigured: true,
  smtpConfigured: true,
  enabledPolicies: [{ enabledAt: hoursAgo(24 * 30) }],
  lastRunAt: hoursAgo(11),
  oldestCleanupAt: null,
};

describe("getRetentionHealthIssues", () => {
  test("reports nothing when everything works", () => {
    expect(getRetentionHealthIssues(healthy, NOW)).toEqual([]);
  });

  test("says the sweep can't run without a job runner, and notices can't be emailed without SMTP", () => {
    expect(
      getRetentionHealthIssues({ ...healthy, jobsConfigured: false, smtpConfigured: false }, NOW)
    ).toEqual([{ code: "jobsNotConfigured" }, { code: "smtpNotConfigured" }]);
  });

  test("flags a missed night only once a run was due", () => {
    expect(getRetentionHealthIssues({ ...healthy, lastRunAt: hoursAgo(49) }, NOW)).toEqual([
      { code: "noRecentRun", lastRunAt: hoursAgo(49).toISOString() },
    ]);
    // Switched on an hour ago: no run is expected yet.
    expect(
      getRetentionHealthIssues(
        { ...healthy, enabledPolicies: [{ enabledAt: hoursAgo(1) }], lastRunAt: null },
        NOW
      )
    ).toEqual([]);
  });

  test("says nothing about runs or SMTP while every policy is off", () => {
    expect(
      getRetentionHealthIssues(
        { ...healthy, enabledPolicies: [], jobsConfigured: false, smtpConfigured: false, lastRunAt: null },
        NOW
      )
    ).toEqual([]);
  });

  test("flags deleted data whose cleanup has waited more than two days, policies or not", () => {
    expect(
      getRetentionHealthIssues({ ...healthy, enabledPolicies: [], oldestCleanupAt: hoursAgo(50) }, NOW)
    ).toEqual([{ code: "cleanupBacklog", oldestAt: hoursAgo(50).toISOString() }]);
    expect(getRetentionHealthIssues({ ...healthy, oldestCleanupAt: hoursAgo(5) }, NOW)).toEqual([]);
  });
});
