"use client";

import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useEffect } from "react";
import { trackWorkflowEvent } from "@/modules/ee/workflows/lib/analytics";
import { WORKFLOW_CLIENT_EVENTS } from "@/modules/ee/workflows/lib/analytics-events";
import { isTypingTarget } from "@/modules/ee/workflows/lib/editor-history";
import { isBranchingStep } from "@/modules/ee/workflows/lib/workflow-steps";
import {
  canMutateCanvasAtom,
  deleteWorkflowNodeAtom,
  stepDeleteRequestAtom,
  workflowDefinitionAtom,
  workflowFlowNodesAtom,
} from "@/modules/ee/workflows/state/editor";

/**
 * Backspace or Delete deletes the highlighted step, as its ⋮ menu's Delete does: an If/else or a Switch
 * asks first (its card shows the confirmation), the trigger stays. React Flow's own delete key is off
 * (workflow-canvas): it only dropped the card from the canvas, so the step came back on the next redraw.
 * Typing in a field is left alone.
 */
export const useDeleteStepShortcut = () => {
  const store = useStore();
  const canMutate = useAtomValue(canMutateCanvasAtom);
  const deleteNode = useSetAtom(deleteWorkflowNodeAtom);
  const requestDelete = useSetAtom(stepDeleteRequestAtom);

  useEffect(() => {
    if (!canMutate) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      const highlighted = store.get(workflowFlowNodesAtom).find((node) => node.selected);
      const step = store.get(workflowDefinitionAtom)?.nodes.find((node) => node.id === highlighted?.id);
      if (!highlighted || !step) return;
      event.preventDefault();
      if (isBranchingStep(step)) {
        requestDelete(step.id);
        return;
      }
      trackWorkflowEvent(WORKFLOW_CLIENT_EVENTS.nodeDeleted, { node_type: highlighted.data.nodeType });
      deleteNode(step.id);
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, [canMutate, deleteNode, requestDelete, store]);
};
