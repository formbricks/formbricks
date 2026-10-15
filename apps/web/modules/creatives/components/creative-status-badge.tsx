"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import type { TCreativeDisplayState, TCreativeDisplayStatus } from "../lib/display-status";

const STATUS_STYLES: Record<TCreativeDisplayStatus, { pill: string; dot: string }> = {
  active: { pill: "border-emerald-200 bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  scheduled: { pill: "border-sky-200 bg-sky-50 text-sky-800", dot: "bg-sky-500" },
  draft: { pill: "border-slate-200 bg-white text-slate-600", dot: "bg-slate-400" },
  paused: { pill: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  closed: { pill: "border-slate-200 bg-slate-100 text-slate-500", dot: "bg-slate-400" },
  archived: { pill: "border-dashed border-slate-300 bg-white text-slate-500", dot: "bg-slate-300" },
};

export const CreativeStatusBadge = ({
  state,
  className,
}: Readonly<{ state: TCreativeDisplayState; className?: string }>) => {
  const { t } = useTranslation();
  const styles = STATUS_STYLES[state.status];
  const labels: Record<TCreativeDisplayStatus, string> = {
    active: t("common.active"),
    scheduled: t("common.scheduled"),
    draft: t("common.draft"),
    paused: t("common.paused"),
    closed: t("common.closed"),
    archived: t("common.archived"),
  };
  const reasons: Record<NonNullable<TCreativeDisplayState["reason"]>, string> = {
    survey_not_active: t("workspace.creatives.status_reason_survey_not_active"),
    schedule_ended: t("workspace.creatives.status_reason_schedule_ended"),
  };
  const reason = state.reason ? reasons[state.reason] : null;

  return (
    <TooltipRenderer shouldRender={!!reason} tooltipContent={reason} triggerClass="inline-flex">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
          styles.pill,
          reason && "cursor-help",
          className
        )}>
        <span className={cn("size-1.5 rounded-full", styles.dot)} aria-hidden="true" />
        {labels[state.status]}
        {reason && <span className="sr-only">{`: ${reason}`}</span>}
      </span>
    </TooltipRenderer>
  );
};
