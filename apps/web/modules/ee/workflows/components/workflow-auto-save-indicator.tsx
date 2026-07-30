"use client";

import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import {
  hasWorkflowAutosaveFailedAtom,
  isWorkflowDirtyAtom,
  isWorkflowSavingAtom,
  workflowLastSavedAtAtom,
} from "@/modules/ee/workflows/state/editor";

const SAVED_FLASH_MS = 3000;

/**
 * Autosave status pill. Reports the draft's actual state rather than the fact that autosave is
 * armed: "Saving…" from the first keystroke until the debounced PATCH lands, then "All changes
 * saved" — briefly in green to acknowledge the save. A draft the autosave gave up on reads
 * "Unsaved changes" instead. The caller hides the pill when autosave can't act (read-only,
 * archived).
 */
export const WorkflowAutoSaveIndicator = () => {
  const { t } = useTranslation();
  const lastSavedAt = useAtomValue(workflowLastSavedAtAtom);
  const isDirty = useAtomValue(isWorkflowDirtyAtom);
  const isSaving = useAtomValue(isWorkflowSavingAtom);
  const hasAutosaveFailed = useAtomValue(hasWorkflowAutosaveFailedAtom);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!lastSavedAt) return;
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), SAVED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [lastSavedAt]);

  // A failed autosave is only stuck while the draft it failed on is still the current one and
  // nothing is in flight: a manual retry (Enter in the title) is a real request to report, and if
  // it lands the draft stops being dirty and the pill settles on its own.
  const isStuck = hasAutosaveFailed && isDirty && !isSaving;
  // Dirty covers the debounce window before the request goes out, so the pill never claims
  // "saved" while the user is still typing.
  const isPending = !isStuck && (isDirty || isSaving);

  const getStatus = () => {
    if (isStuck) {
      return {
        label: t("workspace.workflows.unsaved_changes"),
        className: "border-amber-200 bg-amber-100 text-amber-800",
      };
    }
    if (isPending) {
      return {
        label: t("workspace.workflows.saving_changes"),
        className: "border-slate-200 bg-slate-100 text-slate-600",
      };
    }
    return {
      label: t("workspace.workflows.all_changes_saved"),
      className: showSaved
        ? "border-green-600 bg-green-50 text-green-800"
        : "border-slate-200 bg-slate-100 text-slate-600",
    };
  };

  const status = getStatus();

  return (
    <span
      className={cn(
        "inline-flex cursor-default items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-300",
        status.className
      )}>
      {status.label}
    </span>
  );
};
