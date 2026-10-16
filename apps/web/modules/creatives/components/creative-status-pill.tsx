"use client";

import { useTranslation } from "react-i18next";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { SurveyStatusPill } from "@/modules/ui/components/survey-status-indicator";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import type { TCreativeDisplayState, TCreativeDisplayStatus } from "../lib/display-status";

// Creatives reuse the surveys list's status pill: their statuses are the survey ones, plus
// "Active" as the word for in progress.
export const PILL_STATES: Record<
  TCreativeDisplayStatus,
  { status: TSurvey["status"]; isScheduled?: boolean; isArchived?: boolean }
> = {
  draft: { status: "draft" },
  scheduled: { status: "paused", isScheduled: true },
  active: { status: "inProgress" },
  paused: { status: "paused" },
  closed: { status: "completed" },
  archived: { status: "completed", isArchived: true },
};

export const CreativeStatusPill = ({ state }: Readonly<{ state: TCreativeDisplayState }>) => {
  const { t } = useTranslation();
  const reasons: Record<NonNullable<TCreativeDisplayState["reason"]>, string> = {
    surveyNotActive: t("workspace.creatives.status_reason_survey_not_active"),
    scheduleEnded: t("workspace.creatives.status_reason_schedule_ended"),
  };
  const reason = state.reason ? reasons[state.reason] : null;

  return (
    <TooltipRenderer shouldRender={!!reason} tooltipContent={reason} triggerClass="inline-flex cursor-help">
      <SurveyStatusPill
        {...PILL_STATES[state.status]}
        label={state.status === "active" ? t("common.active") : undefined}
      />
      {reason && <span className="sr-only">{reason}</span>}
    </TooltipRenderer>
  );
};
