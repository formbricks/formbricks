"use client";

import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import {
  hasWorkflowSaveFailedAtom,
  isWorkflowDirtyAtom,
  isWorkflowSavingAtom,
  workflowLastSavedAtAtom,
  workflowSaveErrorAtom,
  workflowValidityAtom,
} from "@/modules/ee/workflows/state/editor";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

const SAVED_FLASH_MS = 3000;

// Same palette as Badge's "success" / "error" / "gray" types, which is what the survey editor's
// equivalent pill matches. "blocked" borrows the "warning" amber: not an error the app hit, but a
// draft the user has to fix (a missing name) before anything can be saved.
const PILL_CLASSES = {
  failed: "border-red-200 bg-red-100 text-red-800",
  blocked: "border-amber-200 bg-amber-100 text-amber-800",
  saved: "border-green-600 bg-green-50 text-green-800",
  idle: "border-slate-200 bg-slate-100 text-slate-600",
} as const;

/**
 * Autosave status pill. Reports the draft's actual state rather than the fact that autosave is
 * armed: "Saving…" from the first keystroke until the debounced PATCH lands, then "All changes
 * saved" — flashing green for a moment to acknowledge the save. It turns red for as long as a save
 * is outstanding: autosaves are silent — they never toast — so the failed state is the only report
 * the user gets, and it has to persist until a save actually lands rather than fade like a toast
 * (ENG-1970). The caller hides the pill when autosave can't act at all (read-only, archived).
 */
export const WorkflowAutoSaveIndicator = () => {
  const { t } = useTranslation();
  const lastSavedAt = useAtomValue(workflowLastSavedAtAtom);
  const hasFailed = useAtomValue(hasWorkflowSaveFailedAtom);
  const saveError = useAtomValue(workflowSaveErrorAtom);
  const isDirty = useAtomValue(isWorkflowDirtyAtom);
  const isSaving = useAtomValue(isWorkflowSavingAtom);
  const { isNameValid } = useAtomValue(workflowValidityAtom);
  const [showSaved, setShowSaved] = useState(false);

  // A dirty draft the autosave can't send at all — the name is empty, so buildWorkflowPatch bails
  // before any request and no save is ever attempted. Without this the pill fell through to the
  // "Saving…" branch and claimed a save was in flight that never was.
  const isBlocked = isDirty && !isNameValid;

  useEffect(() => {
    if (!lastSavedAt) return;
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), SAVED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [lastSavedAt]);

  // An outstanding failure outranks everything else: a save that succeeded three seconds ago is not
  // the headline when the one after it didn't, and a draft waiting out the debounce behind a failed
  // one has no business claiming it is on its way. Below that, dirty covers the debounce window
  // before the request goes out, so the pill never reads "saved" while the user is still typing.
  let state: keyof typeof PILL_CLASSES = "idle";
  let label = t("workspace.workflows.all_changes_saved");
  if (hasFailed) {
    state = "failed";
    label = t("workspace.workflows.autosave_failed");
  } else if (isBlocked) {
    // Above "Saving…": a draft that can never be sent is not on its way. The inline error on the
    // title field says which field and why; the pill just reports the unsaved state honestly.
    state = "blocked";
    label = t("workspace.workflows.autosave_blocked");
  } else if (isDirty || isSaving) {
    label = t("workspace.workflows.saving_changes");
  } else if (showSaved) {
    state = "saved";
  }

  // A rejected draft has a reason worth quoting; an unreachable one has nothing to quote. The
  // generic copy is deliberately not "we'll retry when you're back online": that only holds for a
  // genuine disconnect, and the same "unreachable" bucket also catches 5xx, DNS and the mutation
  // timeout, where no `online` event is ever coming and the promise would sit there unfulfilled
  // (raised in review of ENG-1970).

  let tooltipContent = t("workspace.workflows.autosave_failed_tooltip");
  if (isBlocked) {
    tooltipContent = t("workspace.workflows.autosave_blocked_tooltip");
  } else if (saveError?.detail) {
    tooltipContent = t("workspace.workflows.autosave_failed_tooltip_rejected", { detail: saveError.detail });
  }
  const hasTooltip = hasFailed || isBlocked;

  return (
    <TooltipRenderer
      shouldRender={hasTooltip}
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
        {hasTooltip ? <span className="sr-only">. {tooltipContent}</span> : null}
      </span>
    </TooltipRenderer>
  );
};
