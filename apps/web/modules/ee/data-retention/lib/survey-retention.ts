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
  /** When the surveys-policy notice for this survey went out, if it did. */
  surveysNoticeSentAt: Date | null;
};

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
  archiveDays: settings.archiveDays,
  deleteDays: settings.deleteDays,
});

/**
 * What each active policy does next to one survey, from the same helpers the sweep uses, so the date
 * shown is the date it acts on. A paused policy is left out. Exemptions hold a survey per policy, but an
 * exemption on either policy also holds it from the surveys policy: deleting a survey deletes its
 * responses, so a responses exemption means nothing unless the survey survives (ENG-3371).
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
}): TSurveyRetentionPlan[] => {
  const plans: TSurveyRetentionPlan[] = [];

  const responses = policies.responses;
  if (responses.enabled) {
    const exempt = exemptPolicies.has("responses");
    const schedulePolicy = toSchedulePolicy("responses", responses);
    const deleteAt =
      exempt || !survey.oldestResponseAt
        ? null
        : getRetentionSchedule(
            schedulePolicy,
            { clock: survey.oldestResponseAt, noticeSentAt: null, archivedAt: null },
            now
          ).deleteAt;
    plans.push({
      policy: "responses",
      exempt,
      nextAction: deleteAt ? "delete" : null,
      nextDate: deleteAt,
      dueCreatedAtOrBefore: deleteAt
        ? getRetentionClockCutoffs(schedulePolicy, now).noticeDueAtOrBefore
        : null,
    });
  }

  const surveys = policies.surveys;
  if (surveys.enabled) {
    const exempt = exemptPolicies.size > 0;
    let nextAction: TSurveyRetentionPlan["nextAction"] = null;
    let nextDate: Date | null = null;
    if (!exempt) {
      const clock = getSurveyRetentionClock(
        { createdAt: survey.createdAt, updatedAt: survey.updatedAt, lastResponseAt: survey.newestResponseAt },
        surveys.conditions
      );
      const schedule = getRetentionSchedule(
        toSchedulePolicy("surveys", surveys),
        { clock, noticeSentAt: survey.surveysNoticeSentAt, archivedAt: survey.archivedAt },
        now
      );
      nextAction = survey.archivedAt ? "delete" : "archive";
      nextDate = survey.archivedAt ? schedule.deleteAt : schedule.archiveAt;
    }
    plans.push({ policy: "surveys", exempt, nextAction, nextDate, dueCreatedAtOrBefore: null });
  }

  return plans;
};
