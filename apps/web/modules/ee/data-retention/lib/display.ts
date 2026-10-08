import type { TFunction } from "i18next";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import type { TRetentionPolicyKind, TRetentionRun } from "../types";

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
 * The counts History shows for a run, per the mock: `null` where the policy has no such step, shown
 * as "—" rather than a misleading 0. Responses send no notices and have no archive; only surveys are
 * archived; for members the last column counts deactivations, which the API reports as `archived`.
 */
export const getRetentionHistoryCounts = (
  run: TRetentionRun
): { notified: number | null; archived: number | null; deletedOrDeactivated: number } => ({
  notified: run.policy === "responses" ? null : run.notified,
  archived: run.policy === "surveys" ? run.archived : null,
  deletedOrDeactivated: run.policy === "members" ? run.archived : run.deleted,
});

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
