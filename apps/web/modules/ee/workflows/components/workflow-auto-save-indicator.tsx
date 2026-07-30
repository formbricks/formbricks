"use client";

import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import {
  isWorkflowDirtyAtom,
  isWorkflowSavingAtom,
  workflowLastSavedAtAtom,
} from "@/modules/ee/workflows/state/editor";

const SAVED_FLASH_MS = 3000;

/**
 * Autosave status pill. Reports the draft's actual state rather than the fact that autosave is
 * armed: "Saving…" from the first keystroke until the debounced PATCH lands, then "All changes
 * saved" — briefly in green to acknowledge the save. The caller hides it when autosave can't act
 * (read-only, archived).
 */
export const WorkflowAutoSaveIndicator = () => {
  const { t } = useTranslation();
  const lastSavedAt = useAtomValue(workflowLastSavedAtAtom);
  const isDirty = useAtomValue(isWorkflowDirtyAtom);
  const isSaving = useAtomValue(isWorkflowSavingAtom);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!lastSavedAt) return;
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), SAVED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [lastSavedAt]);

  // Dirty covers the debounce window before the request goes out, so the pill never claims
  // "saved" while the user is still typing.
  const isPending = isDirty || isSaving;

  return (
    <span
      className={cn(
        "inline-flex cursor-default items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-300",
        showSaved && !isPending
          ? "border-green-600 bg-green-50 text-green-800"
          : "border-slate-200 bg-slate-100 text-slate-600"
      )}>
      {isPending ? t("workspace.workflows.saving_changes") : t("workspace.workflows.all_changes_saved")}
    </span>
  );
};
