import type { RetentionEntity, RetentionSurveyCondition } from "@formbricks/database/prisma-browser";
import { SURVEY_ARCHIVE_RETENTION_DAYS } from "@/modules/survey/archive/lib/retention-days";

/**
 * The one place retention dates are computed (ENG-3697). The API, the UI, the emails and the nightly
 * sweep all call this, so the date someone is shown is the date the sweep acts on. Nothing here is
 * stored: every date is derived from the policy, the target's clock and the two facts the sweep does
 * store (when the notice was delivered, and when the survey was archived).
 *
 * Every policy has the same two steps, in whole days: a notice, then the action `periodDays` after the
 * target's clock. The action depends on the kind of data: responses are deleted, surveys archived (the
 * archive purge deletes them `SURVEY_ARCHIVE_RETENTION_DAYS` later), members deactivated.
 * - The notice is due `warnDays` before the action, and the warning always runs in full: the action
 *   never happens less than `warnDays` after the notice was delivered, so a late notice pushes it back.
 * - A notice counts only once delivered (`RetentionNotice.deliveredAt`): a claim that never reached the
 *   mail transport can't let the action run.
 *
 * Pure (its only import is a constant), so client components can use it too.
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
 * Whether a target's notice is tied to its clock. A survey's or member's notice is about that target
 * becoming due, so it counts only while the target's clock is the one it was computed for
 * (`RetentionNotice.clockAt`): any activity since voids it. The responses reminder is sent once per
 * survey (8 Oct), while each response has its own clock, so it records none and only a policy change
 * voids it.
 */
const NOTICE_FOLLOWS_CLOCK = {
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
  periodDays: number;
};

export type TRetentionTargetState = {
  /**
   * The target's last activity: see `getSurveyRetentionClock` and `getMemberRetentionClock`. For the
   * responses policy, the oldest response's `createdAt`.
   */
  clock: Date;
  /**
   * When the target's notice was claimed for sending (`RetentionNotice.sentAt`). Validity is judged on
   * this, the moment the email's dates were computed: a notice built from settings that changed before
   * it went out says the wrong date, so it doesn't count.
   */
  noticeClaimedAt: Date | null;
  /** When that notice was delivered (`RetentionNotice.deliveredAt`); the warning counts from here. */
  noticeDeliveredAt: Date | null;
  /**
   * The clock that notice was computed for (`RetentionNotice.clockAt`), for surveys and members. The
   * notice's dates hold only while the target's clock is still this one, whenever the clock moved (even
   * between the sweep reading it and claiming the notice). Unused for the responses reminder.
   */
  noticeClockAt: Date | null;
  /**
   * When the target's latest exemption ended (`LEAST(until, revokedAt)`), if it had one. A notice from
   * before it is void, so nothing acts on the strength of a warning given before the hold.
   */
  heldUntil: Date | null;
  /** Surveys: when the survey was archived (`Survey.archivedAt`), by the policy or by hand. */
  archivedAt: Date | null;
};

export type TRetentionSchedule = {
  /** When the notice is due, according to the clock. */
  warnAt: Date;
  /** When the notice was delivered or, until it is, when it is expected: `warnAt`, or now if that passed. */
  noticeAt: Date;
  /** Whether a delivered notice is on record and still valid. */
  noticeSent: boolean;
  /**
   * When the policy acts: responses deleted, survey archived, member deactivated. For a survey that is
   * already archived, when it was.
   */
  actionAt: Date;
  /**
   * When the data is gone for good: the responses' deletion, or the survey's purge (the window after the
   * archive or the latest exemption's end, whichever is later). Null for members.
   */
  deleteAt: Date | null;
};

export type TRetentionStep = "notify" | "act";

/**
 * A notice counts only once delivered, and only if it was claimed after the policy's current
 * configuration took effect (`enabledAt` moves on switch-on, unpause or tightening) and after the
 * target's latest exemption ended, and, for clock-bound notices, only while the target's clock is the one
 * the notice was computed for. Otherwise the next cycle sends a new notice and the full warning runs
 * again (ENG-3614). Returns when the warning started.
 */
const getValidNoticeDeliveredAt = (
  policy: TRetentionSchedulePolicy,
  target: TRetentionTargetState,
  now: Date
): Date | null => {
  const { noticeClaimedAt, noticeDeliveredAt } = target;
  if (!noticeClaimedAt || !noticeDeliveredAt) return null;
  if (NOTICE_FOLLOWS_CLOCK[policy.entity] && target.noticeClockAt?.getTime() !== target.clock.getTime()) {
    return null;
  }
  // A policy without `enabledAt` is treated as switched on now, so no earlier notice counts for it.
  if (!isAtOrBefore(policy.enabledAt ?? now, noticeClaimedAt)) return null;
  if (target.heldUntil && !isAtOrBefore(target.heldUntil, noticeClaimedAt)) return null;
  return noticeDeliveredAt;
};

export const getRetentionSchedule = (
  policy: TRetentionSchedulePolicy,
  target: TRetentionTargetState,
  now: Date
): TRetentionSchedule => {
  const plannedActionAt = addRetentionDays(target.clock, policy.periodDays);
  const warnAt = addRetentionDays(plannedActionAt, -policy.warnDays);
  const noticeDeliveredAt = getValidNoticeDeliveredAt(policy, target, now);
  const noticeAt = noticeDeliveredAt ?? latest(warnAt, now);

  const actionAt =
    policy.entity === "surveys" && target.archivedAt
      ? target.archivedAt
      : latest(plannedActionAt, addRetentionDays(noticeAt, policy.warnDays));

  let deleteAt: Date | null = null;
  if (policy.entity === "responses") deleteAt = actionAt;
  // The purge gives a survey the full window from its archive or from the end of its latest exemption,
  // whichever is later (`getSurveyPurgeEligibleWhere`).
  if (policy.entity === "surveys") {
    const purgeFrom = target.heldUntil ? latest(actionAt, target.heldUntil) : actionAt;
    deleteAt = addRetentionDays(purgeFrom, SURVEY_ARCHIVE_RETENTION_DAYS);
  }

  return { warnAt, noticeAt, noticeSent: noticeDeliveredAt !== null, actionAt, deleteAt };
};

/**
 * The step the sweep should take on a target now, or null if nothing is due. The sweep selects
 * candidates in SQL with `getRetentionClockCutoffs`, then re-checks each one with this under lock. An
 * archived survey has nothing left for the policy to do: the archive purge deletes it. Exemptions, the
 * licence and whether the policy is on are the caller's to check.
 */
export const getDueRetentionStep = (
  policy: TRetentionSchedulePolicy,
  target: TRetentionTargetState,
  now: Date
): TRetentionStep | null => {
  if (policy.entity === "surveys" && target.archivedAt) return null;

  const schedule = getRetentionSchedule(policy, target, now);
  if (!schedule.noticeSent) return isAtOrBefore(schedule.warnAt, now) ? "notify" : null;
  return isAtOrBefore(schedule.actionAt, now) ? "act" : null;
};

export type TRetentionClockCutoffs = {
  /** A target whose clock is at or before this is due a notice. */
  noticeDueAtOrBefore: Date;
  /**
   * A target whose clock is at or before this is past its planned action. Never sufficient on its own:
   * the target's notice must also have been delivered for `warnDays`, which only
   * `getDueRetentionStep` checks. Null while no notice can have run that long yet (the policy took
   * effect less than `warnDays` ago), so nothing can be selected for action before then.
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
  const actionDueAtOrBefore = addRetentionDays(now, -policy.periodDays);
  // A valid notice is claimed at or after `enabledAt` and must then run for `warnDays`.
  const warningCanHaveRun = isAtOrBefore(addRetentionDays(policy.enabledAt ?? now, policy.warnDays), now);
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
 * A member's clock under the members policy: when they were last active — their last sign-in, or the
 * last session they started or renewed (`User.lastActiveAt`; a session in use is renewed once it is a
 * day old, so with a `SESSION_MAX_AGE` above a day someone who stays signed in for weeks still counts as
 * active) — or, for someone with no sign-in on record, the day the policy was switched on. A
 * reactivation restarts it. Whichever is latest.
 */
export const getMemberRetentionClock = (
  member: { lastLoginAt: Date | null; lastActiveAt: Date | null; reactivatedAt: Date | null },
  policy: Pick<TRetentionSchedulePolicy, "enabledAt">,
  now: Date
): Date =>
  [member.lastActiveAt, member.reactivatedAt].reduce<Date>(
    (clock, date) => (date ? latest(clock, date) : clock),
    member.lastLoginAt ?? policy.enabledAt ?? now
  );
