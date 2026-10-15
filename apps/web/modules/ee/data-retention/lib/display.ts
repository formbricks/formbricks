import type { TFunction } from "i18next";
import { formatDateForDisplay, formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { SURVEY_ARCHIVE_RETENTION_DAYS } from "@/modules/survey/archive/lib/retention-days";
import type {
  TRetentionExemption,
  TRetentionPolicyKind,
  TRetentionPolicySettings,
  TRetentionRun,
  TRetentionSurveyCondition,
  TSurveyRetention,
  TSurveyRetentionPolicy,
} from "../types";
import { daysToRetentionPeriod } from "./period";

export const getRetentionPolicyLabel = (policy: TRetentionPolicyKind, t: TFunction): string => {
  switch (policy) {
    case "responses":
      return t("common.responses");
    case "surveys":
      return t("common.surveys");
    case "members":
      return t("common.members");
  }
};

/**
 * The counts History shows for a run: `null` where the policy's run has no such step, shown as "—"
 * rather than a 0 that reads as "nothing happened". Every policy notifies (responses once, when they
 * first fall due). Per policy:
 * - responses: no archive; the last column counts deletions.
 * - surveys: Archived counts archives, and the last column deletions: the archive purge, which deletes
 *   an archived survey 30 days later, records the ones the policy archived in a run of its own.
 * - members: no archive; the last column counts deactivations, which the API reports as `archived`.
 */
export const getRetentionHistoryCounts = (
  run: TRetentionRun
): { notified: number; archived: number | null; deletedOrDeactivated: number | null } => {
  switch (run.policy) {
    case "responses":
      return { notified: run.notified, archived: null, deletedOrDeactivated: run.deleted };
    case "surveys":
      return { notified: run.notified, archived: run.archived, deletedOrDeactivated: run.deleted };
    case "members":
      return { notified: run.notified, archived: null, deletedOrDeactivated: run.archived };
  }
};

/**
 * A History count formatter for the app's locale: grouped digits, and "—" where the policy has no
 * such step (see `getRetentionHistoryCounts`). Build it once per render, not per cell.
 */
export const createRetentionCountFormatter = (locale: string): ((value: number | null) => string) => {
  const numberFormat = new Intl.NumberFormat(locale);
  return (value) => (value === null ? "—" : numberFormat.format(value));
};

/**
 * A date as History and Exemptions show it: the calendar day in the organisation's display time zone,
 * so a night's run, or an exemption's last day, shows on the day it is there.
 */
export const formatRetentionDate = (iso: string, locale: string, timeZone: string): string =>
  formatDateForDisplay(new Date(iso), locale, { year: "numeric", month: "short", day: "numeric", timeZone });

/**
 * When a run started, as History shows it: the day and the time in the organisation's display time zone,
 * so several runs on one day (a re-run, a capped night finishing) can be told apart.
 */
export const formatRetentionRunTime = (iso: string, locale: string, timeZone: string): string =>
  formatDateTimeForDisplay(new Date(iso), locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });

/** A number of days as the dialogs state it: "3 years", "6 months", "45 days". */
export const formatRetentionPeriod = (days: number, t: TFunction): string => {
  const { amount, unit } = daysToRetentionPeriod(days);
  switch (unit) {
    case "years":
      return t("workspace.settings.data_retention.period_years", { count: amount });
    case "months":
      return t("workspace.settings.data_retention.period_months", { count: amount });
    case "days":
      return t("workspace.settings.data_retention.period_days", { count: amount });
  }
};

/**
 * A notice length, always in days: "14 days", "60 days". The notice is set and validated in days (its
 * custom field and its 14–90 limits), so "2 months" next to them would read as a different unit.
 */
export const formatRetentionNotice = (days: number, t: TFunction): string =>
  t("workspace.settings.data_retention.period_days", { count: days });

const getConditionShortLabel = (condition: TRetentionSurveyCondition, t: TFunction): string => {
  switch (condition) {
    case "noResponse":
      return t("workspace.settings.data_retention.condition_no_response_short");
    case "noChange":
      return t("workspace.settings.data_retention.condition_no_change_short");
    case "createdBefore":
      return t("workspace.settings.data_retention.condition_created_before_short");
  }
};

/** One line saying what a policy does, for the Policies table: "Delete 3 years after collection". */
export const getRetentionPolicySummary = (
  policy: TRetentionPolicyKind,
  settings: TRetentionPolicySettings,
  t: TFunction,
  locale: string
): string => {
  const period = formatRetentionPeriod(settings.periodDays, t);
  switch (policy) {
    case "responses":
      return t("workspace.settings.data_retention.responses_summary", { period });
    case "surveys":
      return t("workspace.settings.data_retention.surveys_summary", {
        period,
        conditions: new Intl.ListFormat(locale, { type: "conjunction" }).format(
          settings.conditions.map((condition) => getConditionShortLabel(condition, t))
        ),
        // Archived surveys are deleted by the archive purge, a fixed period later for everyone.
        deletePeriod: formatRetentionPeriod(SURVEY_ARCHIVE_RETENTION_DAYS, t),
      });
    case "members":
      return t("workspace.settings.data_retention.members_summary", { period });
  }
};

/**
 * The exemption that holds a survey from a policy the longest. Responses: only a responses exemption
 * holds them. Surveys: either kind holds the survey itself (ENG-3371), so the one that ends last.
 */
const getHoldingExemption = (
  exemptions: readonly TRetentionExemption[],
  policy: TRetentionExemption["policy"]
): TRetentionExemption | undefined =>
  exemptions
    .filter((exemption) => policy === "surveys" || exemption.policy === policy)
    .reduce<
      TRetentionExemption | undefined
    >((longest, exemption) => (!longest || exemption.until > longest.until ? exemption : longest), undefined);

/** One policy's line for a survey: what it does next and when, or that the survey is exempt. */
const describeSurveyRetentionPlan = (
  retention: TSurveyRetention,
  plan: TSurveyRetentionPolicy,
  t: TFunction,
  formatDate: (iso: string) => string
): string => {
  const policy = getRetentionPolicyLabel(plan.policy, t);
  if (plan.exempt) {
    const holding = getHoldingExemption(retention.exemptions, plan.policy);
    return holding
      ? t("workspace.settings.data_retention.survey_line_exempt", {
          policy,
          date: formatDate(holding.until),
        })
      : t("workspace.settings.data_retention.survey_line_exempt_no_date", { policy });
  }
  if (!plan.nextAction || !plan.nextDate) {
    return t("workspace.settings.data_retention.survey_line_nothing_due", { policy });
  }
  const date = formatDate(plan.nextDate);
  if (plan.policy === "responses") {
    return t("workspace.settings.data_retention.survey_line_responses_delete", { date });
  }
  return plan.nextAction === "archive"
    ? t("workspace.settings.data_retention.survey_line_survey_archive", { date })
    : t("workspace.settings.data_retention.survey_line_survey_delete", { date });
};

/** One line per active policy, for the survey's settings card: what happens next, and when. */
export const getSurveyRetentionLines = (
  retention: TSurveyRetention,
  t: TFunction,
  formatDate: (iso: string) => string
): string[] => retention.policies.map((plan) => describeSurveyRetentionPlan(retention, plan, t, formatDate));

/**
 * Only the lines for the policies the survey is exempt from, for the survey summary's note, which
 * otherwise just points at the policies: "Surveys: exempt until Mar 31, 2027."
 */
export const getSurveyRetentionExemptLines = (
  retention: TSurveyRetention,
  t: TFunction,
  formatDate: (iso: string) => string
): string[] =>
  retention.policies
    .filter((plan) => plan.exempt)
    .map((plan) => describeSurveyRetentionPlan(retention, plan, t, formatDate));

/**
 * The dated warning on the survey summary while responses are inside the notice window: "214
 * responses are due for deletion, the first on Oct 3". Null when none are.
 */
export const getSurveyRetentionDueWarning = (
  retention: TSurveyRetention,
  t: TFunction,
  locale: string,
  formatDate: (iso: string) => string
): string | null => {
  const responses = retention.policies.find((plan) => plan.policy === "responses");
  if (!responses?.dueCount || !responses.nextDate) return null;

  const date = formatDate(responses.nextDate);
  return responses.dueCount.relation === "gte"
    ? t("workspace.settings.data_retention.responses_due_for_deletion_capped", {
        total: new Intl.NumberFormat(locale).format(responses.dueCount.count),
        date,
      })
    : t("workspace.settings.data_retention.responses_due_for_deletion", {
        count: responses.dueCount.count,
        date,
      });
};
