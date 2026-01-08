"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface AutoSaveIndicatorProps {
  isDraft: boolean;
  lastSaved: Date | null;
}

export const AutoSaveIndicator = ({ isDraft, lastSaved }: AutoSaveIndicatorProps) => {
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

  const isSavedState = isDraft && showSaved;

  const text = !isDraft
    ? t("environments.surveys.edit.auto_save_disabled")
    : showSaved
      ? t("environments.surveys.edit.progress_saved")
      : t("environments.surveys.edit.auto_save_on");

  const badge = (
    <span
      className={cn(
        "inline-flex cursor-default items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-300",
        isSavedState
          ? "border-green-600 bg-green-50 text-green-800"
          : "border-slate-200 bg-slate-100 text-slate-600"
      )}>
      {text}
    </span>
  );

  return (
    <TooltipRenderer
      shouldRender={!isDraft}
      tooltipContent={t("environments.surveys.edit.auto_save_disabled_tooltip")}
      className="max-w-64 text-center">
      {badge}
    </TooltipRenderer>
  );
};
