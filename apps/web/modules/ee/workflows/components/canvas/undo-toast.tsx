"use client";

import type { useStore } from "jotai";
import toast from "react-hot-toast";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import { workflowUndoAtom } from "@/modules/ee/workflows/state/editor";

interface TUndoToastInput {
  message: string;
  undoLabel: string;
  /** The definition before the edit: Undo only acts while that edit is still the last one. */
  previous: TWorkflowDefinition;
  store: ReturnType<typeof useStore>;
}

/**
 * Says an edit happened ("Moved “…”.", "Deleted “…”.") with an Undo that undoes it through the editor's
 * history, so Redo can bring it back. After another edit, Undo is the toolbar's and the button does nothing.
 */
export const showUndoToast = ({ message, undoLabel, previous, store }: TUndoToastInput) =>
  toast.success(
    (instance) => (
      <div className="flex items-center gap-3">
        <span>{message}</span>
        <button
          type="button"
          className="text-sm font-medium text-black underline hover:text-slate-700"
          onClick={() => {
            toast.dismiss(instance.id);
            const history = store.get(workflowUndoAtom);
            if (history?.undoesTo(previous)) history.undo();
          }}>
          {undoLabel}
        </button>
      </div>
    ),
    { duration: 6000 }
  );
