/**
 * What can keep data retention from working on this deployment, for the banners owners and managers see
 * above the Data retention tabs (ENG-3612). Pure, so the route and its tests share it.
 */

/** Nightly, so more than two days without a run means at least one night was missed. */
export const RETENTION_HEALTH_STALE_MS = 48 * 60 * 60 * 1000;

export type TRetentionHealthIssue =
  /** No job runner: the nightly sweep can't run at all. */
  | { code: "jobsNotConfigured" }
  /** Policies are on, but the sweep hasn't run for this organisation lately. */
  | { code: "noRecentRun"; lastRunAt: string | null }
  /** Notices are recorded but can't be emailed. */
  | { code: "smtpNotConfigured" }
  /** Hub records or files of deleted data have been waiting more than two days to be removed. */
  | { code: "cleanupBacklog"; oldestAt: string };

export type TRetentionHealthFacts = {
  jobsConfigured: boolean;
  smtpConfigured: boolean;
  /** When each enabled policy took effect. */
  enabledPolicies: readonly { enabledAt: Date | null }[];
  /** The organisation's latest run, of any policy. */
  lastRunAt: Date | null;
  /** The organisation's oldest pending deletion cleanup. */
  oldestCleanupAt: Date | null;
};

export const getRetentionHealthIssues = (
  facts: TRetentionHealthFacts,
  now: Date
): TRetentionHealthIssue[] => {
  const issues: TRetentionHealthIssue[] = [];
  const isStale = (date: Date) => now.getTime() - date.getTime() > RETENTION_HEALTH_STALE_MS;
  const policiesOn = facts.enabledPolicies.length > 0;

  if (policiesOn && !facts.jobsConfigured) issues.push({ code: "jobsNotConfigured" });
  // Only once a policy has been on long enough for a run to be expected.
  const expectsRun = facts.enabledPolicies.some((policy) => policy.enabledAt && isStale(policy.enabledAt));
  if (facts.jobsConfigured && expectsRun && (!facts.lastRunAt || isStale(facts.lastRunAt))) {
    issues.push({ code: "noRecentRun", lastRunAt: facts.lastRunAt?.toISOString() ?? null });
  }
  if (policiesOn && !facts.smtpConfigured) issues.push({ code: "smtpNotConfigured" });
  if (facts.oldestCleanupAt && isStale(facts.oldestCleanupAt)) {
    issues.push({ code: "cleanupBacklog", oldestAt: facts.oldestCleanupAt.toISOString() });
  }
  return issues;
};
