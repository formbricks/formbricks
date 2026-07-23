"use client";

import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { workflowLastSavedAtAtom } from "@/modules/ee/workflows/state/editor";

const SAVED_FLASH_MS = 3000;

/**
 * Autosave status pill, same shape as the survey editor's AutoSaveIndicator: a quiet
 * "Auto-save on" that flashes green "Changes saved" for a moment after each successful save
 * (auto or manual). The caller hides it when autosave can't act (read-only, archived).
 */
export const WorkflowAutoSaveIndicator = () => {
  const { t } = useTranslation();
  const lastSavedAt = useAtomValue(workflowLastSavedAtAtom);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!lastSavedAt) return;
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), SAVED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [lastSavedAt]);

  return (
    <span
      className={cn(
        "inline-flex cursor-default items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-300",
        showSaved
          ? "border-green-600 bg-green-50 text-green-800"
          : "border-slate-200 bg-slate-100 text-slate-600"
      )}>
      {showSaved ? t("workspace.workflows.changes_saved") : t("workspace.workflows.autosave_on")}
    </span>
  );
};
