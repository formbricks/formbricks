import type { TRetentionExemptionPolicy, TRetentionPolicySettings } from "../types";
import {
  type TRetentionSchedulePolicy,
  getRetentionClockCutoffs,
  getRetentionSchedule,
  getSurveyRetentionClock,
} from "./schedule";

export type TSurveyRetentionFacts = {
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  oldestResponseAt: Date | null;
  newestResponseAt: Date | null;
  /** The surveys-policy notice for this survey, if one was claimed. */
  surveysNotice: TNoticeState | null;
  /** The one-time responses reminder for this survey, if one was claimed. */
  responsesNotice: TNoticeState | null;
  /** When the survey's latest exemption on either policy ended; it holds the survey itself. */
  surveyHeldUntil: Date | null;
  /** When the survey's latest responses exemption ended. */
  responsesHeldUntil: Date | null;
};

export type TNoticeState = { claimedAt: Date; deliveredAt: Date | null };

export type TSurveyRetentionPolicyInput = TRetentionPolicySettings & { enabledAt: Date | null };

export type TSurveyRetentionPlan = {
  policy: TRetentionExemptionPolicy;
  exempt: boolean;
  nextAction: "archive" | "delete" | null;
  nextDate: Date | null;
  /** Responses policy: responses created at or before this are inside the warning window. */
  dueCreatedAtOrBefore: Date | null;
};

const toSchedulePolicy = (
  entity: TRetentionExemptionPolicy,
  settings: TSurveyRetentionPolicyInput
): TRetentionSchedulePolicy => ({
  entity,
  enabledAt: settings.enabledAt,
  warnDays: settings.warnDays,
  periodDays: settings.periodDays,
});

/** A date that has passed means the next nightly run acts on it, so it is reported as now. */
const notBefore = (date: Date | null, now: Date): Date | null =>
  date && date.getTime() < now.getTime() ? now : date;

const getResponsesPlan = (
  policy: TSurveyRetentionPolicyInput,
  survey: TSurveyRetentionFacts,
  exempt: boolean,
  now: Date
): TSurveyRetentionPlan => {
  const empty = {
    policy: "responses",
    exempt,
    nextAction: null,
    nextDate: null,
    dueCreatedAtOrBefore: null,
  } as const;
  if (exempt || !survey.oldestResponseAt) return empty;

  const schedulePolicy = toSchedulePolicy("responses", policy);
  const { deleteAt } = getRetentionSchedule(
    schedulePolicy,
    {
      clock: survey.oldestResponseAt,
      noticeClaimedAt: survey.responsesNotice?.claimedAt ?? null,
      noticeDeliveredAt: survey.responsesNotice?.deliveredAt ?? null,
      archivedAt: null,
      heldUntil: survey.responsesHeldUntil,
    },
    now
  );
  if (!deleteAt) return empty;

  const dueCutoff = getRetentionClockCutoffs(schedulePolicy, now).noticeDueAtOrBefore;
  return {
    ...empty,
    nextAction: "delete",
    nextDate: notBefore(deleteAt, now),
    // Only worth counting when the oldest response is already inside the warning window.
    dueCreatedAtOrBefore: survey.oldestResponseAt.getTime() <= dueCutoff.getTime() ? dueCutoff : null,
  };
};

const getSurveysPlan = (
  policy: TSurveyRetentionPolicyInput,
  survey: TSurveyRetentionFacts,
  exempt: boolean,
  now: Date
): TSurveyRetentionPlan => {
  if (exempt) {
    return { policy: "surveys", exempt, nextAction: null, nextDate: null, dueCreatedAtOrBefore: null };
  }

  const clock = getSurveyRetentionClock(
    { createdAt: survey.createdAt, updatedAt: survey.updatedAt, lastResponseAt: survey.newestResponseAt },
    policy.conditions
  );
  const schedule = getRetentionSchedule(
    toSchedulePolicy("surveys", policy),
    {
      clock,
      noticeClaimedAt: survey.surveysNotice?.claimedAt ?? null,
      noticeDeliveredAt: survey.surveysNotice?.deliveredAt ?? null,
      archivedAt: survey.archivedAt,
      heldUntil: survey.surveyHeldUntil,
    },
    now
  );
  return {
    policy: "surveys",
    exempt,
    nextAction: survey.archivedAt ? "delete" : "archive",
    // Archived (by the policy or by hand): the archive purge deletes it a fixed period later.
    nextDate: notBefore(survey.archivedAt ? schedule.deleteAt : schedule.actionAt, now),
    dueCreatedAtOrBefore: null,
  };
};

/**
 * What each active policy does next to one survey, from the same helpers the sweep uses, so the date
 * shown is the date it acts on; a date already passed is reported as `now`, the next run. A paused
 * policy is left out. Exemptions hold a survey per policy, but an exemption on either policy also holds
 * it from the surveys policy: deleting a survey deletes its responses, so a responses exemption means
 * nothing unless the survey survives (ENG-3371).
 */
export const getSurveyRetentionPlan = ({
  policies,
  survey,
  exemptPolicies,
  now,
}: {
  policies: Readonly<Record<TRetentionExemptionPolicy, TSurveyRetentionPolicyInput>>;
  survey: TSurveyRetentionFacts;
  exemptPolicies: ReadonlySet<TRetentionExemptionPolicy>;
  now: Date;
}): TSurveyRetentionPlan[] => [
  ...(policies.responses.enabled
    ? [getResponsesPlan(policies.responses, survey, exemptPolicies.has("responses"), now)]
    : []),
  ...(policies.surveys.enabled
    ? [getSurveysPlan(policies.surveys, survey, exemptPolicies.size > 0, now)]
    : []),
];
