"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

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

  const badge = (
    // A polite live region, so a screen reader hears the switch to "not saved" (and back) without
    // having to look for it.
    <span
      role="status"
      className={cn(
        "inline-flex cursor-default items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors duration-300",
        isSavedState && "border-green-600 bg-green-50 text-green-800",
        isFailedState && "border-warning/50 bg-warning-background text-warning-foreground",
        !isSavedState && !isFailedState && "border-slate-200 bg-slate-100 text-slate-600"
      )}>
      {text}
    </span>
  );

  return (
    <TooltipRenderer
      shouldRender={!isDraft || isFailedState}
      tooltipContent={
        isFailedState
          ? t("workspace.surveys.edit.auto_save_failed_tooltip")
          : t("workspace.surveys.edit.auto_save_disabled_tooltip")
      }
      className="max-w-64 text-center">
      {badge}
    </TooltipRenderer>
  );
};
