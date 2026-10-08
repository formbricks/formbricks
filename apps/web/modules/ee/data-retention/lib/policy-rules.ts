import {
  RETENTION_SURVEY_CONDITIONS,
  type TRetentionPolicyKind,
  type TRetentionPolicySettings,
  type TRetentionSurveyCondition,
} from "../types";

/**
 * The policy rules every writer and the edit dialogs share: the defaults a never-saved policy reads as,
 * the limits, and when a change restarts the warning (ENG-3614). Pure, so the API and the UI cannot
 * disagree.
 */

/** The notice: two weeks to three months before the action (8 Oct). */
export const RETENTION_WARN_DAYS = { min: 14, max: 90, default: 60 } as const;
/** The period of every policy: 30 days to 10 years. */
export const RETENTION_PERIOD_DAYS = { min: 30, max: 3650 } as const;

/** What a policy that has never been saved reads as. Off until someone switches it on. */
export const RETENTION_POLICY_DEFAULTS: Readonly<Record<TRetentionPolicyKind, TRetentionPolicySettings>> = {
  responses: { enabled: false, warnDays: RETENTION_WARN_DAYS.default, periodDays: 1095, conditions: [] },
  surveys: {
    enabled: false,
    warnDays: RETENTION_WARN_DAYS.default,
    periodDays: 1095,
    conditions: ["noResponse", "noChange"],
  },
  members: { enabled: false, warnDays: RETENTION_WARN_DAYS.default, periodDays: 365, conditions: [] },
};

export type TRetentionPolicyIssue = { field: keyof TRetentionPolicySettings; reason: string };

const isWholeNumberInRange = (value: number, { min, max }: { min: number; max: number }) =>
  Number.isInteger(value) && value >= min && value <= max;

/**
 * The business rules a complete policy must meet; an empty list means it is valid. Each issue names
 * the field it is about, so the API can return it as an invalid parameter.
 */
export const getRetentionPolicyIssues = (
  policy: TRetentionPolicyKind,
  settings: TRetentionPolicySettings
): TRetentionPolicyIssue[] => {
  const issues: TRetentionPolicyIssue[] = [];

  if (!isWholeNumberInRange(settings.warnDays, RETENTION_WARN_DAYS)) {
    issues.push({
      field: "warnDays",
      reason: `The notice must be between ${RETENTION_WARN_DAYS.min} and ${RETENTION_WARN_DAYS.max} days.`,
    });
  }
  if (!isWholeNumberInRange(settings.periodDays, RETENTION_PERIOD_DAYS)) {
    issues.push({
      field: "periodDays",
      reason: `The period must be between ${RETENTION_PERIOD_DAYS.min} and ${RETENTION_PERIOD_DAYS.max} days.`,
    });
  }

  if (policy === "surveys") {
    const distinct = new Set(settings.conditions);
    if (distinct.size === 0 || distinct.size !== settings.conditions.length) {
      issues.push({ field: "conditions", reason: "Choose one to three different conditions." });
    }
  } else if (settings.conditions.length > 0) {
    issues.push({ field: "conditions", reason: "Only the surveys policy has conditions." });
  }

  return issues;
};

const sameConditions = (a: readonly TRetentionSurveyCondition[], b: readonly TRetentionSurveyCondition[]) =>
  a.length === b.length && RETENTION_SURVEY_CONDITIONS.every((c) => a.includes(c) === b.includes(c));

/**
 * When the policy's current configuration took effect, after a change from `previous` (null for a
 * policy never saved) to `next`. The warning always runs in full from that moment (ENG-3614), so it is
 * reset to `now` when the policy is switched on or unpaused, and when an active policy changes in a way
 * that could bring an action earlier: a shorter period or notice, or different survey conditions.
 * Lengthening, or editing a paused policy, leaves it alone; unpausing resets it anyway.
 */
export const getRetentionPolicyEnabledAt = (
  previous: (TRetentionPolicySettings & { enabledAt: Date | null }) | null,
  next: TRetentionPolicySettings,
  now: Date
): Date | null => {
  if (!next.enabled) return previous?.enabledAt ?? null;
  if (!previous?.enabled || previous.enabledAt === null) return now;

  const couldActEarlier =
    next.warnDays < previous.warnDays ||
    next.periodDays < previous.periodDays ||
    !sameConditions(next.conditions, previous.conditions);

  return couldActEarlier ? now : previous.enabledAt;
};

/** Whether two settings are the same policy, so saving one over the other changes nothing. */
export const isSameRetentionPolicy = (a: TRetentionPolicySettings, b: TRetentionPolicySettings): boolean =>
  a.enabled === b.enabled &&
  a.warnDays === b.warnDays &&
  a.periodDays === b.periodDays &&
  sameConditions(a.conditions, b.conditions);
