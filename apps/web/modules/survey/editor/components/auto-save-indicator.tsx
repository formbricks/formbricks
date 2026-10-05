"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

interface AutoSaveIndicatorProps {
  isDraft: boolean;
  lastSaved: Date | null;
  hasFailed: boolean;
}

export const AutoSaveIndicator = ({ isDraft, lastSaved, hasFailed }: Readonly<AutoSaveIndicatorProps>) => {
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

  // A failed save outranks a recent success: the author must not be told their work is safe while
  // the latest attempt to save it did not land.
  const isFailedState = isDraft && hasFailed;
  const isSavedState = isDraft && showSaved && !hasFailed;

  const text = useMemo(() => {
    if (!isDraft) {
      return t("workspace.surveys.edit.auto_save_disabled");
    }

    if (hasFailed) {
      return t("workspace.surveys.edit.auto_save_failed");
    }

    if (showSaved) {
      return t("workspace.surveys.edit.progress_saved");
    }

    return t("workspace.surveys.edit.auto_save_on");
  }, [hasFailed, isDraft, showSaved, t]);

  const hasTooltip = !isDraft || isFailedState;
  const tooltipText = isFailedState
    ? t("workspace.surveys.edit.auto_save_failed_tooltip")
    : t("workspace.surveys.edit.auto_save_disabled_tooltip");

  const badgeClassName = cn(
    "inline-flex cursor-default items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors duration-300",
    isSavedState && "border-green-600 bg-green-50 text-green-800",
    isFailedState && "border-warning/50 bg-warning-background text-warning-foreground",
    !isSavedState && !isFailedState && "border-slate-200 bg-slate-100 text-slate-600"
  );

  return (
    <>
      {hasTooltip ? (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* A real button (no action of its own) so keyboard users can reach the tooltip, and
                  the tooltip's aria-describedby lands on the element that holds focus. */}
              <button type="button" className={badgeClassName}>
                {text}
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-64 text-center">{tooltipText}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <span className={badgeClassName}>{text}</span>
      )}
      {/* The live region speaks only when a save fails, with the explanation the tooltip carries. The
          visible badge is not a live region: it changes on every save ("Progress saved", then back
          after 3s), which would talk over an author typing with a screen reader every 10 seconds. */}
      <output className="sr-only">
        {isFailedState && (
          <>
            <span>{text}</span> <span>{tooltipText}</span>
          </>
        )}
      </output>
    </>
  );
};
