import {
  RETENTION_SURVEY_CONDITIONS,
  type TRetentionPolicyKind,
  type TRetentionPolicySettings,
  type TRetentionSurveyCondition,
} from "../types";

/**
 * The policy rules every writer and the edit dialogs share (ENG-3695): the defaults a never-saved
 * policy reads as, the limits, and when a change restarts the warning (ENG-3614). Pure, so the API and
 * the UI cannot disagree.
 */

export const RETENTION_WARN_DAYS = { min: 30, max: 90, default: 60 } as const;
/** The main period of every policy: 30 days to 10 years. */
export const RETENTION_PERIOD_DAYS = { min: 30, max: 3650 } as const;
/** A survey is deleted this long after it is archived; the archive window is not configurable. */
export const RETENTION_SURVEY_DELETE_DAYS = 30;

/** What a policy that has never been saved reads as. Off until someone switches it on. */
export const RETENTION_POLICY_DEFAULTS: Readonly<Record<TRetentionPolicyKind, TRetentionPolicySettings>> = {
  responses: {
    enabled: false,
    warnDays: RETENTION_WARN_DAYS.default,
    archiveDays: null,
    deleteDays: 1095,
    conditions: [],
  },
  surveys: {
    enabled: false,
    warnDays: RETENTION_WARN_DAYS.default,
    archiveDays: 1095,
    deleteDays: RETENTION_SURVEY_DELETE_DAYS,
    conditions: ["noResponse", "noChange"],
  },
  members: {
    enabled: false,
    warnDays: RETENTION_WARN_DAYS.default,
    archiveDays: 365,
    deleteDays: null,
    conditions: [],
  },
};

/** The field that carries a policy's main period: archive for surveys and members, delete for responses. */
export const getRetentionPeriodField = (policy: TRetentionPolicyKind): "archiveDays" | "deleteDays" =>
  policy === "responses" ? "deleteDays" : "archiveDays";

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

  const periodField = getRetentionPeriodField(policy);
  const period = settings[periodField];
  if (period === null || !isWholeNumberInRange(period, RETENTION_PERIOD_DAYS)) {
    issues.push({
      field: periodField,
      reason: `The period must be between ${RETENTION_PERIOD_DAYS.min} and ${RETENTION_PERIOD_DAYS.max} days.`,
    });
  }

  if (policy === "responses" && settings.archiveDays !== null) {
    issues.push({ field: "archiveDays", reason: "Responses are deleted, never archived." });
  }
  if (policy === "members" && settings.deleteDays !== null) {
    issues.push({ field: "deleteDays", reason: "Members are deactivated, never deleted." });
  }
  if (policy === "surveys" && settings.deleteDays !== RETENTION_SURVEY_DELETE_DAYS) {
    issues.push({
      field: "deleteDays",
      reason: `Surveys are deleted ${RETENTION_SURVEY_DELETE_DAYS} days after they are archived.`,
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

const isShorter = (next: number | null, previous: number | null) =>
  next !== null && previous !== null && next < previous;

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
    isShorter(next.warnDays, previous.warnDays) ||
    isShorter(next.archiveDays, previous.archiveDays) ||
    isShorter(next.deleteDays, previous.deleteDays) ||
    !sameConditions(next.conditions, previous.conditions);

  return couldActEarlier ? now : previous.enabledAt;
};

/** Whether two settings are the same policy, so saving one over the other changes nothing. */
export const isSameRetentionPolicy = (a: TRetentionPolicySettings, b: TRetentionPolicySettings): boolean =>
  a.enabled === b.enabled &&
  a.warnDays === b.warnDays &&
  a.archiveDays === b.archiveDays &&
  a.deleteDays === b.deleteDays &&
  sameConditions(a.conditions, b.conditions);
