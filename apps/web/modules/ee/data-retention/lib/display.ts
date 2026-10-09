import type { TFunction } from "i18next";
import { formatDateForDisplay } from "@/lib/utils/datetime";
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
 * - surveys: Archived counts archives; the last column is "—", because the run never deletes a
 *   survey (the archive purge does, later and outside any run).
 * - members: no archive; the last column counts deactivations, which the API reports as `archived`.
 */
export const getRetentionHistoryCounts = (
  run: TRetentionRun
): { notified: number; archived: number | null; deletedOrDeactivated: number | null } => {
  switch (run.policy) {
    case "responses":
      return { notified: run.notified, archived: null, deletedOrDeactivated: run.deleted };
    case "surveys":
      return { notified: run.notified, archived: run.archived, deletedOrDeactivated: null };
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

/** One line per active policy, for the survey's settings card: what happens next, and when. */
export const getSurveyRetentionLines = (
  retention: TSurveyRetention,
  t: TFunction,
  formatDate: (iso: string) => string
): string[] =>
  retention.policies.map((plan: TSurveyRetentionPolicy) => {
    const policy = getRetentionPolicyLabel(plan.policy, t);
    if (plan.exempt) {
      // The exemption that holds it; under ENG-3371 either one holds the survey from the surveys policy.
      const holding: TRetentionExemption | undefined =
        retention.exemptions.find((exemption) => exemption.policy === plan.policy) ?? retention.exemptions[0];
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
  });

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
