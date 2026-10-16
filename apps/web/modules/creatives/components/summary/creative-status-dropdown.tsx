"use client";

import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { SurveyStatusIndicator } from "@/modules/ui/components/survey-status-indicator";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import type { TCreativeDisplayState, TCreativeDisplayStatus } from "../../lib/display-status";
import type { TSummaryStatus } from "../../lib/summary";
import { PILL_STATES } from "../creative-status-pill";

interface CreativeStatusDropdownProps {
  /** The author's status, which the options set. */
  value: TSummaryStatus;
  /** What the creative shows now, which the trigger names: the schedule and its survey have a say. */
  state: TCreativeDisplayState;
  disabled?: boolean;
  onChange: (status: TSummaryStatus) => void;
}

/**
 * The survey summary's status dropdown in creative words: Active · Paused · Closed. The trigger shows
 * the derived status (Scheduled, or Paused with its survey, with the reason on hover), as the survey's
 * shows Scheduled for a paused survey with a publish date.
 */
export const CreativeStatusDropdown = ({
  value,
  state,
  disabled,
  onChange,
}: Readonly<CreativeStatusDropdownProps>) => {
  const { t } = useTranslation();
  // Every status has a word, though only a published, unarchived creative gets this control.
  const words: Record<TCreativeDisplayStatus, string> = {
    draft: t("common.draft"),
    scheduled: t("common.scheduled"),
    active: t("common.active"),
    paused: t("common.paused"),
    closed: t("common.closed"),
    archived: t("common.archived"),
  };
  const reasons: Record<NonNullable<TCreativeDisplayState["reason"]>, string> = {
    surveyNotActive: t("workspace.creatives.status_reason_survey_not_active"),
    scheduleEnded: t("workspace.creatives.status_reason_schedule_ended"),
  };
  const indicator = PILL_STATES[state.status];
  const reason = state.reason ? reasons[state.reason] : null;

  return (
    <TooltipRenderer shouldRender={!!reason} tooltipContent={reason} triggerClass="inline-flex">
      <Select value={value} disabled={disabled} onValueChange={(next: TSummaryStatus) => onChange(next)}>
        <SelectTrigger className="w-[170px] bg-white md:w-[200px]" aria-label={t("common.status")}>
          <SelectValue>
            <span className="flex items-center">
              <SurveyStatusIndicator status={indicator.status} isScheduled={indicator.isScheduled} />
              <span className="ml-2 text-sm text-slate-700">{words[state.status]}</span>
              {reason && <span className="sr-only">{reason}</span>}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-white">
          <SelectItem className="group font-normal hover:text-slate-900" value="inProgress">
            <span className="flex w-full items-center gap-2">
              <SurveyStatusIndicator status="inProgress" />
              {t("common.active")}
            </span>
          </SelectItem>
          <SelectItem className="group font-normal hover:text-slate-900" value="paused">
            <span className="flex w-full items-center gap-2">
              <SurveyStatusIndicator status="paused" />
              {t("common.paused")}
            </span>
          </SelectItem>
          <SelectItem className="group font-normal hover:text-slate-900" value="completed">
            <span className="flex w-full items-center gap-2">
              <SurveyStatusIndicator status="completed" />
              {t("common.closed")}
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </TooltipRenderer>
  );
};
