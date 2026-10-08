import type { RetentionEntity, RetentionSurveyCondition } from "@formbricks/database/prisma-browser";

/**
 * The one place retention dates are computed (ENG-3697). The API, the UI, the emails and the nightly
 * sweep all call this, so the date someone is shown is the date the sweep acts on. Nothing here is
 * stored: every date is derived from the policy, the target's clock and the two facts the sweep does
 * store (when the notice went out, and when the target was archived).
 *
 * Every policy has the same stages, in whole days: warn → archive (the reversible step: archive a
 * survey, deactivate a member) → delete.
 * - The first action stage (archive, or delete when there is no archive) is anchored to the clock.
 * - The warning starts `warnDays` before it and always runs in full: the action never happens less than
 *   `warnDays` after the warning actually started, so a late notice pushes the action back.
 * - Delete follows the *actual* archive date, not the planned one.
 *
 * Pure and dependency-free, so client components can use it too.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whole days as fixed 24-hour steps. This matches `timestamp + n * interval '1 day'` on the
 * `timestamp(3)` (UTC) columns, so the sweep's SQL and this helper agree to the millisecond.
 */
export const addRetentionDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * MS_PER_DAY);

const latest = (a: Date, b: Date): Date => (a.getTime() >= b.getTime() ? a : b);

const isAtOrBefore = (a: Date, b: Date): boolean => a.getTime() <= b.getTime();

/**
 * Whether a policy's warning is a notice the sweep sends and records. Responses get none: the survey
 * summary shows a dated warning instead, visible from the moment the policy is switched on.
 */
export const RETENTION_ENTITY_SENDS_NOTICE = {
  responses: false,
  surveys: true,
  members: true,
} as const satisfies Record<RetentionEntity, boolean>;

export type TRetentionSchedulePolicy = {
  entity: RetentionEntity;
  /**
   * When the current configuration took effect (switched on, unpaused, or tightened; see
   * `RetentionPolicy.enabledAt`). Null for a policy that is off: treated as "on from now".
   */
  enabledAt: Date | null;
  warnDays: number;
  archiveDays: number | null;
  deleteDays: number | null;
};

export type TRetentionTargetState = {
  /** The target's last activity: see `getSurveyRetentionClock` and `getMemberRetentionClock`. */
  clock: Date;
  /** From the target's `RetentionNotice` row, if there is one. A notice older than the clock is void. */
  noticeSentAt: Date | null;
  /** When the reversible step happened (`Survey.archivedAt`). Null if it hasn't. */
  archivedAt: Date | null;
};

export type TRetentionSchedule = {
  /** When the warning period starts, according to the clock. */
  warnAt: Date;
  /**
   * When the notice went out or, until it has, when it is expected to: `warnAt`, or the next sweep if
   * that has already passed. Null for policies that send no notice.
   */
  noticeAt: Date | null;
  /** Whether a notice is on record and still valid for the current clock. */
  noticeSent: boolean;
  /** When the target is (or was) archived. Null for policies without an archive step. */
  archiveAt: Date | null;
  /** When the target is deleted. Null for policies that never delete. */
  deleteAt: Date | null;
};

export type TRetentionStep = "notify" | "archive" | "delete";

const getFirstStageDays = (policy: TRetentionSchedulePolicy): number => {
  const days = policy.archiveDays ?? policy.deleteDays;
  if (days === null) {
    // The database rejects such a row (RetentionPolicy_action_stage_check); this is unreachable.
    throw new Error("A retention policy needs an archive or a delete stage");
  }
  return days;
};

/**
 * A notice counts only if it went out after both the target's clock and the policy's current
 * configuration took effect. A clock reset voids it (the target became active again), and so does a
 * policy being switched on, unpaused or tightened (`enabledAt` moves): either way the next cycle sends
 * a new notice and the full warning runs again (ENG-3614).
 */
const getValidNoticeSentAt = (
  policy: TRetentionSchedulePolicy,
  target: TRetentionTargetState
): Date | null => {
  const { noticeSentAt } = target;
  if (!noticeSentAt || !isAtOrBefore(target.clock, noticeSentAt)) return null;
  if (policy.enabledAt && !isAtOrBefore(policy.enabledAt, noticeSentAt)) return null;
  return noticeSentAt;
};

export const getRetentionSchedule = (
  policy: TRetentionSchedulePolicy,
  target: TRetentionTargetState,
  now: Date
): TRetentionSchedule => {
  const firstStageDays = getFirstStageDays(policy);
  const plannedFirstStageAt = addRetentionDays(target.clock, firstStageDays);
  const warnAt = addRetentionDays(plannedFirstStageAt, -policy.warnDays);
  const noticeSentAt = getValidNoticeSentAt(policy, target);

  let noticeAt: Date | null = null;
  let warningStartedAt: Date;
  if (RETENTION_ENTITY_SENDS_NOTICE[policy.entity]) {
    noticeAt = noticeSentAt ?? latest(warnAt, now);
    warningStartedAt = noticeAt;
  } else {
    // No notice to wait for, but the warning still can't start before the policy was switched on.
    warningStartedAt = latest(warnAt, policy.enabledAt ?? now);
  }

  const firstStageAt = latest(plannedFirstStageAt, addRetentionDays(warningStartedAt, policy.warnDays));

  if (policy.archiveDays === null) {
    return { warnAt, noticeAt, noticeSent: noticeSentAt !== null, archiveAt: null, deleteAt: firstStageAt };
  }

  const archiveAt = target.archivedAt ?? firstStageAt;
  return {
    warnAt,
    noticeAt,
    noticeSent: noticeSentAt !== null,
    archiveAt,
    deleteAt: policy.deleteDays === null ? null : addRetentionDays(archiveAt, policy.deleteDays),
  };
};

/**
 * The step the sweep should take on a target now, or null if nothing is due. The sweep selects
 * candidates in SQL with `getRetentionClockCutoffs`, then re-checks each one with this under lock.
 * Exemptions, the licence and whether the policy is on are the caller's to check.
 */
export const getDueRetentionStep = (
  policy: TRetentionSchedulePolicy,
  target: TRetentionTargetState,
  now: Date
): TRetentionStep | null => {
  const schedule = getRetentionSchedule(policy, target, now);

  if (target.archivedAt !== null && policy.archiveDays !== null) {
    return schedule.deleteAt && isAtOrBefore(schedule.deleteAt, now) ? "delete" : null;
  }

  if (RETENTION_ENTITY_SENDS_NOTICE[policy.entity] && !schedule.noticeSent) {
    return isAtOrBefore(schedule.warnAt, now) ? "notify" : null;
  }

  const firstStageAt = schedule.archiveAt ?? schedule.deleteAt;
  if (!firstStageAt || !isAtOrBefore(firstStageAt, now)) return null;
  return policy.archiveDays === null ? "delete" : "archive";
};

export type TRetentionClockCutoffs = {
  /** A target whose clock is at or before this is due a notice (policies that send one). */
  noticeDueAtOrBefore: Date;
  /**
   * A target whose clock is at or before this is past its planned first action stage. For policies
   * with a notice, the notice must also have been out for `warnDays`; checking that is the caller's.
   * Null when nothing can be due yet: a policy without a notice, switched on less than `warnDays` ago.
   */
  actionDueAtOrBefore: Date | null;
};

/**
 * The `<=` bounds on the clock for the sweep's candidate queries, derived from the same rules as
 * `getRetentionSchedule`, so the SQL never re-derives the arithmetic. Always `<=`, never `=`: a missed
 * night, a capped run or a late notice is still caught on the next one.
 */
export const getRetentionClockCutoffs = (
  policy: TRetentionSchedulePolicy,
  now: Date
): TRetentionClockCutoffs => {
  const firstStageDays = getFirstStageDays(policy);
  const actionDueAtOrBefore = addRetentionDays(now, -firstStageDays);
  const warningCanHaveRun =
    RETENTION_ENTITY_SENDS_NOTICE[policy.entity] ||
    isAtOrBefore(addRetentionDays(policy.enabledAt ?? now, policy.warnDays), now);

  return {
    noticeDueAtOrBefore: addRetentionDays(actionDueAtOrBefore, policy.warnDays),
    actionDueAtOrBefore: warningCanHaveRun ? actionDueAtOrBefore : null,
  };
};

export type TSurveyRetentionClockInput = {
  createdAt: Date;
  updatedAt: Date;
  /** The newest response's `createdAt`, or null for a survey with none. */
  lastResponseAt: Date | null;
};

/**
 * A survey's clock under the surveys policy: the latest of the timestamps its ticked conditions read.
 * Every ticked condition must hold and they share one period, so the latest timestamp decides.
 * `updatedAt` always counts, ticked or not, so restoring an archived survey (which bumps it) restarts
 * the full period. A survey with no responses satisfies "no response" from the start.
 */
export const getSurveyRetentionClock = (
  survey: TSurveyRetentionClockInput,
  conditions: readonly RetentionSurveyCondition[]
): Date => {
  let clock = survey.updatedAt;
  if (conditions.includes("noResponse") && survey.lastResponseAt) {
    clock = latest(clock, survey.lastResponseAt);
  }
  if (conditions.includes("createdBefore")) {
    clock = latest(clock, survey.createdAt);
  }
  return clock;
};

/**
 * A member's clock under the members policy: their last sign-in or, for someone with none on record,
 * the day the policy was switched on. A reactivation restarts it, whichever is later.
 */
export const getMemberRetentionClock = (
  member: { lastLoginAt: Date | null; reactivatedAt: Date | null },
  policy: Pick<TRetentionSchedulePolicy, "enabledAt">,
  now: Date
): Date => {
  const clock = member.lastLoginAt ?? policy.enabledAt ?? now;
  return member.reactivatedAt ? latest(clock, member.reactivatedAt) : clock;
};
