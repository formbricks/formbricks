"use client";

import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { isWorkflowSavingAtom, workflowLastSavedAtAtom } from "@/modules/ee/workflows/state/editor";

const SAVED_FLASH_MS = 3000;

/**
 * Autosave status pill, same shape as the survey editor's AutoSaveIndicator: a quiet
 * "Auto-save on" that reads "Saving…" while a PATCH is in flight, then flashes green "Changes
 * saved" for a moment after each successful save (auto or manual). The caller hides it when
 * autosave can't act (read-only, archived).
 *
 * The in-flight state is what tells the user their edits are actually being persisted — without it
 * the pill reads the same whether autosave is working or silently doing nothing. Failures surface
 * as a toast from the save flow, so the pill has no error state of its own.
 */
export const WorkflowAutoSaveIndicator = () => {
  const { t } = useTranslation();
  const lastSavedAt = useAtomValue(workflowLastSavedAtAtom);
  const isSaving = useAtomValue(isWorkflowSavingAtom);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!lastSavedAt) return;
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), SAVED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [lastSavedAt]);

  // "Saving…" wins over the flash: a save that starts while the previous one's flash is still up
  // should read as in-flight, not as already done.
  const isSavedState = !isSaving && showSaved;

  const getLabel = () => {
    if (isSaving) return t("workspace.workflows.autosave_saving");
    if (showSaved) return t("workspace.workflows.changes_saved");
    return t("workspace.workflows.autosave_on");
  };

  return (
    // Polite live region: the state changes on its own (debounced autosave), so it has to be
    // announced without the user having moved focus here.
    <span
      aria-live="polite"
      className={cn(
        "inline-flex cursor-default items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-300",
        isSavedState
          ? "border-green-600 bg-green-50 text-green-800"
          : "border-slate-200 bg-slate-100 text-slate-600"
      )}>
      {getLabel()}
    </span>
  );
};
