"use client";

import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { type TWorkflowNode, WORKFLOW_LIMITS } from "@formbricks/workflows";
import { isTypingTarget } from "@/modules/ee/workflows/lib/editor-history";
import { getNodeRegistryEntry } from "@/modules/ee/workflows/lib/node-registry";
import {
  type TPasteTarget,
  findStepsReadingUnreachableSteps,
} from "@/modules/ee/workflows/lib/step-clipboard";
import { isBranchingStep } from "@/modules/ee/workflows/lib/workflow-steps";
import {
  canMutateCanvasAtom,
  canPasteWorkflowStepsAtAtom,
  cancelWorkflowStepCutAtom,
  copyWorkflowStepAtom,
  cutWorkflowStepAtom,
  pasteWorkflowStepsAtom,
  selectedWorkflowNodeIdAtom,
  workflowDefinitionAtom,
} from "@/modules/ee/workflows/state/editor";

/**
 * Cut, copy and paste of steps for the canvas: the step menus, every `+` and the keyboard. A paste
 * that leaves a step reading a step that no longer runs before it says so; the cards of those steps
 * show the problem too, as the checks before Enable do.
 */
export const useStepClipboard = () => {
  const { t } = useTranslation();
  const store = useStore();
  const cutSteps = useSetAtom(cutWorkflowStepAtom);
  const copySteps = useSetAtom(copyWorkflowStepAtom);

  // Nothing on the canvas says where cut or copied steps go: the toast points at the `+` buttons,
  // which offer "Paste here".
  const cut = useCallback(
    (nodeId: string) => {
      const count = cutSteps(nodeId);
      if (count > 0) toast.success(t("workspace.workflows.steps_cut_hint", { count }));
    },
    [cutSteps, t]
  );
  const copy = useCallback(
    (nodeId: string) => {
      const count = copySteps(nodeId);
      if (count > 0) toast.success(t("workspace.workflows.steps_copied_hint", { count }));
    },
    [copySteps, t]
  );
  const pasteSteps = useSetAtom(pasteWorkflowStepsAtom);
  const canPasteAt = useAtomValue(canPasteWorkflowStepsAtAtom);

  const paste = useCallback(
    (target: TPasteTarget) => {
      const before = new Set(findStepsReadingUnreachableSteps(store.get(workflowDefinitionAtom)!));
      const result = pasteSteps({
        target,
        copyLabel: (node) =>
          t("workspace.workflows.step_copy_label", {
            label: getNodeRegistryEntry(node as TWorkflowNode).title(node as TWorkflowNode, t),
          }),
      });
      if (!result.ok) {
        if (result.reason === "step_limit") {
          toast.error(t("workspace.workflows.step_limit_reached", { count: WORKFLOW_LIMITS.maxSteps }));
        }
        return;
      }
      const definition = store.get(workflowDefinitionAtom);
      const broken = definition
        ? findStepsReadingUnreachableSteps(definition).filter((id) => !before.has(id))
        : [];
      if (broken.length > 0) {
        toast.error(t("workspace.workflows.paste_unreachable_variables", { count: broken.length }));
      }
    },
    [pasteSteps, store, t]
  );

  return { cut, copy, paste, canPasteAt };
};

/**
 * The canvas's keyboard shortcuts for the clipboard, on the selected step: ⌘X and ⌘C cut or copy it with
 * every step after it, ⌘V pastes right after it (not after an If/else or Switch: pick a branch's `+`),
 * and Escape puts a pending cut back. Typing in a field, or copying selected text, is left alone.
 */
export const useStepClipboardShortcuts = () => {
  const store = useStore();
  const canMutate = useAtomValue(canMutateCanvasAtom);
  const cancelCut = useSetAtom(cancelWorkflowStepCutAtom);
  const { cut, copy, paste, canPasteAt } = useStepClipboard();

  useEffect(() => {
    if (!canMutate) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === "Escape") {
        cancelCut();
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (globalThis.getSelection()?.toString()) return;
      const key = event.key.toLowerCase();
      if (key !== "x" && key !== "c" && key !== "v") return;
      const definition = store.get(workflowDefinitionAtom);
      const selectedId = store.get(selectedWorkflowNodeIdAtom);
      const selected = definition?.nodes.find((node) => node.id === selectedId);
      if (!definition || !selected) return;
      event.preventDefault();
      if (key === "x") cut(selected.id);
      else if (key === "c") copy(selected.id);
      else if (!isBranchingStep(selected)) {
        const next = definition.edges.find((edge) => edge.source === selected.id);
        const target: TPasteTarget = next ? { edgeId: next.id } : { sourceNodeId: selected.id };
        if (canPasteAt(target)) paste(target);
      }
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, [canMutate, cancelCut, canPasteAt, copy, cut, paste, store]);
};
