"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import {
  EMPTY_HISTORY,
  type TEditorHistory,
  isTypingTarget,
  recordEdit,
  redoStep,
  undoStep,
} from "@/modules/ee/workflows/lib/editor-history";
import { settleSentSecretValues } from "@/modules/ee/workflows/lib/http-request-panel";
import {
  canEditWorkflowDefinitionAtom,
  cancelWorkflowStepCutAtom,
  lastSecretSettleAtom,
  setWorkflowDefinitionAtom,
  workflowAtom,
  workflowDefinitionAtom,
  workflowStepClipboardAtom,
  workflowUndoAtom,
} from "@/modules/ee/workflows/state/editor";

/**
 * Undo and redo for the workflow being edited, with Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z (or Ctrl+Y).
 * Every change to the definition is recorded, whatever made it: a form field, the canvas, Discard
 * changes. Undoing writes the older definition back through the normal editor state, so autosave
 * saves it like any edit. The history lives in this page only and resets when another workflow loads.
 * The keyboard shortcuts work only while `shortcutsEnabled` (the Editor tab): on Runs nothing shows
 * the draft, so a shortcut there would change it unseen.
 */
export const useWorkflowHistory = ({ shortcutsEnabled }: { shortcutsEnabled: boolean }) => {
  const definition = useAtomValue(workflowDefinitionAtom);
  const workflowId = useAtomValue(workflowAtom)?.id ?? null;
  const canEdit = useAtomValue(canEditWorkflowDefinitionAtom);
  const lastSecretSettle = useAtomValue(lastSecretSettleAtom);
  const setDefinition = useSetAtom(setWorkflowDefinitionAtom);
  const [history, setHistory] = useState<TEditorHistory>(EMPTY_HISTORY);
  const previous = useRef<{ workflowId: string | null; definition: TWorkflowDefinition | null }>({
    workflowId: null,
    definition: null,
  });
  // Set while an undo or redo writes the definition, so that write isn't recorded as a new edit.
  const isApplying = useRef(false);

  useEffect(() => {
    const last = previous.current;
    previous.current = { workflowId, definition };
    // A newly loaded workflow starts with an empty history.
    if (last.workflowId !== workflowId) {
      setHistory(EMPTY_HISTORY);
      return;
    }
    if (isApplying.current) {
      isApplying.current = false;
      return;
    }
    // A save swapping sent secret values for stored ones is no edit. Older steps drop the same
    // plaintext values, so undoing never sends a secret again.
    if (lastSecretSettle?.result === definition) {
      const { sent } = lastSecretSettle;
      // eslint-disable-next-line react/set-state-in-effect -- the history records definition changes the editor writes elsewhere (atoms), so it follows them here
      setHistory((current) => ({
        ...current,
        past: current.past.map((step) => settleSentSecretValues(step, sent)),
        future: current.future.map((step) => settleSentSecretValues(step, sent)),
      }));
      return;
    }
    if (last.definition && definition && last.definition !== definition) {
      const before = last.definition;
      setHistory((current) => recordEdit(current, before, Date.now()));
    }
  }, [definition, workflowId, lastSecretSettle]);

  const apply = useCallback(
    (step: typeof undoStep) => {
      if (!canEdit || !definition) return;
      const result = step(history, definition);
      if (!result) return;
      isApplying.current = true;
      setHistory(result.history);
      setDefinition(result.definition);
    },
    [canEdit, definition, history, setDefinition]
  );

  // Undo first puts back a cut that wasn't pasted, the last thing done; the next Undo undoes edits.
  const clipboard = useAtomValue(workflowStepClipboardAtom);
  const cancelCut = useSetAtom(cancelWorkflowStepCutAtom);
  const undo = useCallback(() => {
    if (clipboard?.mode === "cut") {
      cancelCut();
      return;
    }
    apply(undoStep);
  }, [apply, cancelCut, clipboard]);
  const redo = useCallback(() => apply(redoStep), [apply]);

  // A toast's Undo (after moving a step) undoes through this history, so Redo can bring the edit back.
  const setUndoForToasts = useSetAtom(workflowUndoAtom);
  const undoesTo = useCallback(
    (earlier: TWorkflowDefinition) => clipboard?.mode !== "cut" && history.past.at(-1) === earlier,
    [clipboard, history]
  );
  useEffect(() => {
    setUndoForToasts({ undo, undoesTo });
    return () => setUndoForToasts(null);
  }, [undo, undoesTo, setUndoForToasts]);

  useEffect(() => {
    if (!shortcutsEnabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const isRedo = (key === "z" && event.shiftKey) || (key === "y" && !event.shiftKey && event.ctrlKey);
      const isUndo = key === "z" && !event.shiftKey;
      if (!isUndo && !isRedo) return;
      event.preventDefault();
      if (isRedo) redo();
      else undo();
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, [shortcutsEnabled, undo, redo]);

  return {
    undo,
    redo,
    canUndo: canEdit && (history.past.length > 0 || clipboard?.mode === "cut"),
    canRedo: canEdit && history.future.length > 0,
  };
};
