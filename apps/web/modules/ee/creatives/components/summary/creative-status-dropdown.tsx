"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { SurveyStatusIndicator } from "@/modules/ui/components/survey-status-indicator";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useCreativeStatusReasonText } from "../../hooks/use-creative-status-reason-text";
import type { TCreativeDisplayState, TCreativeDisplayStatus } from "../../lib/display-status";
import type { TSummaryStatus } from "../../lib/summary";
import { PILL_STATES } from "../creative-status-pill";

interface CreativeStatusDropdownProps {
  /** The author's status, which the options set. */
  value: TSummaryStatus;
  /** The statuses it may be set to (`getSummaryStatusControl`): only Paused and Closed in wind-down. */
  options: readonly TSummaryStatus[];
  /** What the creative shows now, which the trigger names: the schedule and its survey have a say. */
  state: TCreativeDisplayState;
  disabled?: boolean;
  onChange: (status: TSummaryStatus) => void;
  /** The trigger's width; the summary's by default. */
  className?: string;
  /** The start is still ahead, so turning it on only schedules it: the option reads Scheduled. */
  isWaitingForStart?: boolean;
}

/** One fixed slot per status icon, so the green dot lines up with the round icons. */
const IndicatorSlot = ({ children }: Readonly<{ children: ReactNode }>) => (
  <span className="flex size-5 shrink-0 items-center justify-center">{children}</span>
);

/**
 * The survey summary's status dropdown in creative words: Active (Scheduled while its start is ahead) ·
 * Paused · Closed. The trigger shows
 * the derived status (Scheduled, or Paused with its survey, with the reason on hover), as the survey's
 * shows Scheduled for a paused survey with a publish date. The editor's header has it too.
 */
export const CreativeStatusDropdown = ({
  value,
  options,
  state,
  disabled,
  onChange,
  className = "w-[170px] md:w-[200px]",
  isWaitingForStart = false,
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
  const reasons = useCreativeStatusReasonText();
  const indicator = PILL_STATES[state.status];
  const reason = state.reason ? reasons[state.reason] : null;

  return (
    <TooltipRenderer shouldRender={!!reason} tooltipContent={reason} triggerClass="inline-flex">
      <Select value={value} disabled={disabled} onValueChange={(next: TSummaryStatus) => onChange(next)}>
        <SelectTrigger className={cn("bg-white", className)} aria-label={t("common.status")}>
          <SelectValue>
            <span className="flex items-center">
              <IndicatorSlot>
                <SurveyStatusIndicator status={indicator.status} isScheduled={indicator.isScheduled} />
              </IndicatorSlot>
              <span className="ml-2 text-sm text-slate-700">{words[state.status]}</span>
              {reason && <span className="sr-only">{reason}</span>}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-white">
          {options.includes("inProgress") && (
            <SelectItem className="group font-normal hover:text-slate-900" value="inProgress">
              <span className="flex w-full items-center gap-2">
                <IndicatorSlot>
                  {isWaitingForStart ? (
                    <SurveyStatusIndicator status="paused" isScheduled />
                  ) : (
                    <SurveyStatusIndicator status="inProgress" />
                  )}
                </IndicatorSlot>
                {isWaitingForStart ? t("common.scheduled") : t("common.active")}
              </span>
            </SelectItem>
          )}
          {options.includes("paused") && (
            <SelectItem className="group font-normal hover:text-slate-900" value="paused">
              <span className="flex w-full items-center gap-2">
                <IndicatorSlot>
                  <SurveyStatusIndicator status="paused" />
                </IndicatorSlot>
                {t("common.paused")}
              </span>
            </SelectItem>
          )}
          {options.includes("completed") && (
            <SelectItem className="group font-normal hover:text-slate-900" value="completed">
              <span className="flex w-full items-center gap-2">
                <IndicatorSlot>
                  <SurveyStatusIndicator status="completed" />
                </IndicatorSlot>
                {t("common.closed")}
              </span>
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </TooltipRenderer>
  );
};
