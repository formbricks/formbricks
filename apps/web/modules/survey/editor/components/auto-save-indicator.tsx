"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import {
  type TAutoSaveBadgeLabel,
  type TAutoSaveBadgeTooltip,
  type TAutoSaveFailure,
  getAutoSaveBadge,
} from "../lib/auto-save-badge";

interface AutoSaveIndicatorProps {
  isDraft: boolean;
  isScheduled: boolean;
  lastSaved: Date | null;
  failure: TAutoSaveFailure | null;
  canSaveManually: boolean;
}

const toneClassName = {
  neutral: "border-slate-200 bg-slate-100 text-slate-600",
  success: "border-green-600 bg-green-50 text-green-800",
  warning: "border-warning/50 bg-warning-background text-warning-foreground",
} as const;

export const AutoSaveIndicator = ({
  isDraft,
  isScheduled,
  lastSaved,
  failure,
  canSaveManually,
}: Readonly<AutoSaveIndicatorProps>) => {
  const { t } = useTranslation();
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (lastSaved) {
      setShowSaved(true);
      const timer = setTimeout(() => {
        setShowSaved(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSaved]);

  const badge = getAutoSaveBadge({ isDraft, isScheduled, failure, showSaved, canSaveManually });
  // Literal t() calls, so the translation scanner sees every key in use.
  const labels: Record<TAutoSaveBadgeLabel, string> = {
    disabled: t("workspace.surveys.edit.auto_save_disabled"),
    paused: t("workspace.surveys.edit.auto_save_paused"),
    on: t("workspace.surveys.edit.auto_save_on"),
    saved: t("workspace.surveys.edit.progress_saved"),
    failed: t("workspace.surveys.edit.auto_save_failed"),
  };
  const tooltips: Record<TAutoSaveBadgeTooltip, string> = {
    disabled: t("workspace.surveys.edit.auto_save_disabled_tooltip"),
    paused: t("workspace.surveys.edit.auto_save_paused_tooltip"),
    on: t("workspace.surveys.edit.auto_save_on_tooltip"),
    failedRetryingOrSaveManually: t("workspace.surveys.edit.auto_save_failed_tooltip"),
    failedRetrying: t("workspace.surveys.edit.auto_save_failed_retrying_tooltip"),
    failedPaused: t("workspace.surveys.edit.auto_save_failed_paused_tooltip"),
    failedStopped: t("workspace.surveys.edit.auto_save_stopped_tooltip"),
  };
  const label = labels[badge.label];
  const tooltip = tooltips[badge.tooltip];

  return (
    <>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Always this one button (no action of its own), so keyboard users can reach the tooltip in
                every state and focus is never lost to a state change unmounting it. */}
            <button
              type="button"
              className={cn(
                "focus-visible:ring-ring inline-flex cursor-default items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors duration-300 focus-visible:ring-1 focus-visible:outline-hidden",
                toneClassName[badge.tone]
              )}>
              {label}
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64 text-center">{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {/* The live region speaks only when a save fails, with the explanation the tooltip carries. The
          visible badge is not a live region: it changes on every save ("Progress saved", then back
          after 3s), which would talk over an author typing with a screen reader every 10 seconds.
          aria-live is explicit although <output> implies it: a modal dialog hides everything outside it
          from screen readers except elements carrying the attribute, and a save can fail while one is
          open (Radix uses aria-hidden's hideOthers). */}
      <output aria-live="polite" className="sr-only">
        {badge.announce && (
          <>
            <span>{label}</span> <span>{tooltip}</span>
          </>
        )}
      </output>
    </>
  );
};
