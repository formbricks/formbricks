"use client";

import { useTranslation } from "react-i18next";
import type { TCreativeDisplayStatusReason } from "../lib/display-status";

/**
 * Why a creative shows another status than its author's, in the dashboard's words: the status pill's and
 * the status menu's hover text, and the toast after a status change that the creative can't follow.
 */
export const useCreativeStatusReasonText = (): Record<NonNullable<TCreativeDisplayStatusReason>, string> => {
  const { t } = useTranslation();
  return {
    surveyNotActive: t("workspace.creatives.status_reason_survey_not_active"),
    scheduleEnded: t("workspace.creatives.status_reason_schedule_ended"),
    destinationMissing: t("workspace.creatives.status_reason_destination_missing"),
    actionMissing: t("workspace.creatives.status_reason_action_missing"),
  };
};
