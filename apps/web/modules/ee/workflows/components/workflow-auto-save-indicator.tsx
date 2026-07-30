"use client";

import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import {
  hasWorkflowSaveFailedAtom,
  workflowLastSavedAtAtom,
  workflowSaveErrorAtom,
} from "@/modules/ee/workflows/state/editor";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

const SAVED_FLASH_MS = 3000;

// Same palette as Badge's "success" / "error" / "gray" types, which is what the survey editor's
// equivalent pill matches.
const PILL_CLASSES = {
  failed: "border-red-200 bg-red-100 text-red-800",
  saved: "border-green-600 bg-green-50 text-green-800",
  idle: "border-slate-200 bg-slate-100 text-slate-600",
} as const;

/**
 * Autosave status pill: a quiet "Auto-save on" that flashes green "Changes saved" for a moment after
 * each successful save, and turns red for as long as a save is outstanding. Autosaves are silent —
 * they never toast — so the failed state is the only report the user gets, and it has to persist
 * until a save actually lands rather than fade like a toast (ENG-1970). The caller hides the pill
 * when autosave can't act at all (read-only, archived).
 */
export const WorkflowAutoSaveIndicator = () => {
  const { t } = useTranslation();
  const lastSavedAt = useAtomValue(workflowLastSavedAtAtom);
  const hasFailed = useAtomValue(hasWorkflowSaveFailedAtom);
  const saveError = useAtomValue(workflowSaveErrorAtom);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!lastSavedAt) return;
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), SAVED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [lastSavedAt]);

  // An outstanding failure outranks the flash: a save that succeeded three seconds ago is not the
  // headline when the one after it didn't.
  let state: keyof typeof PILL_CLASSES = "idle";
  let label = t("workspace.workflows.autosave_on");
  if (hasFailed) {
    state = "failed";
    label = t("workspace.workflows.autosave_failed");
  } else if (showSaved) {
    state = "saved";
    label = t("workspace.workflows.changes_saved");
  }

  // A rejected draft has a reason worth quoting; an unreachable API only has "we'll retry".
  const tooltipContent = saveError?.detail
    ? t("workspace.workflows.autosave_failed_tooltip_rejected", { detail: saveError.detail })
    : t("workspace.workflows.autosave_failed_tooltip");

  return (
    <TooltipRenderer
      shouldRender={hasFailed}
      tooltipContent={tooltipContent}
      className="max-w-64 text-center">
      {/* A live region because this pill is the whole report: autosave never toasts, so a failure
          that is only a colour change is a failure nobody is told about. Polite, not assertive —
          it should not interrupt someone mid-edit. The detail rides along as screen-reader-only
          text rather than an aria-label, so the announcement carries it too; the tooltip that
          shows it visually is hover-only. */}
      <span
        role="status"
        aria-live="polite"
        className={cn(
          "inline-flex cursor-default items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-300",
          PILL_CLASSES[state]
        )}>
        {label}
        {hasFailed ? <span className="sr-only">. {tooltipContent}</span> : null}
      </span>
    </TooltipRenderer>
  );
};
