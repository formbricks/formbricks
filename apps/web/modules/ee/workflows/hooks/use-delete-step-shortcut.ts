"use client";

import { useAtomValue, useSetAtom, useStore } from "jotai";
import { type RefObject, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { showUndoToast } from "@/modules/ee/workflows/components/canvas/undo-toast";
import { trackWorkflowEvent } from "@/modules/ee/workflows/lib/analytics";
import { WORKFLOW_CLIENT_EVENTS } from "@/modules/ee/workflows/lib/analytics-events";
import { isTypingTarget } from "@/modules/ee/workflows/lib/editor-history";
import { getNodeRegistryEntry } from "@/modules/ee/workflows/lib/node-registry";
import { isBranchingStep } from "@/modules/ee/workflows/lib/workflow-steps";
import {
  canMutateCanvasAtom,
  deleteWorkflowNodeAtom,
  stepDeleteRequestAtom,
  workflowDefinitionAtom,
  workflowFlowNodesAtom,
} from "@/modules/ee/workflows/state/editor";

const isInside = (container: HTMLElement | null, target: EventTarget | null) =>
  !!container && target instanceof Node && container.contains(target);

/**
 * Backspace or Delete deletes the highlighted step, as its ⋮ menu's Delete does: an If/else or a Switch
 * asks first (its card shows the confirmation), the trigger stays. React Flow's own delete key is off
 * (workflow-canvas): it only dropped the card from the canvas, so the step came back on the next redraw.
 *
 * Only while the canvas has the user's attention: the last click (or keyboard focus) was on the canvas.
 * After a click in the step panel, the header or the page, the keys do nothing there, so leaving a field
 * and pressing Backspace once more can't delete a step unseen. A delete always says so, with Undo.
 */
export const useDeleteStepShortcut = (canvasRef: RefObject<HTMLElement | null>) => {
  const { t } = useTranslation();
  const store = useStore();
  const canMutate = useAtomValue(canMutateCanvasAtom);
  const deleteNode = useSetAtom(deleteWorkflowNodeAtom);
  const requestDelete = useSetAtom(stepDeleteRequestAtom);
  const isCanvasActiveRef = useRef(false);

  useEffect(() => {
    if (!canMutate) return;
    // Pointer: inside the canvas arms the keys, anywhere else disarms them. Keyboard: tabbing onto a card
    // arms them; focus moving elsewhere is left alone, as a panel may focus its first field on opening.
    const onPointerDown = (event: PointerEvent) => {
      isCanvasActiveRef.current = isInside(canvasRef.current, event.target);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (isInside(canvasRef.current, event.target)) isCanvasActiveRef.current = true;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (!isCanvasActiveRef.current) return;
      // Tabbing from a card into the step panel keeps the canvas armed; a key pressed on a panel control
      // (a select, a button) is meant for that control, never for the step.
      const isPageTarget = event.target === document.body || event.target === document.documentElement;
      if (!isPageTarget && !isInside(canvasRef.current, event.target)) return;
      const highlighted = store.get(workflowFlowNodesAtom).find((node) => node.selected);
      const previous = store.get(workflowDefinitionAtom);
      const step = previous?.nodes.find((node) => node.id === highlighted?.id);
      if (!highlighted || !previous || !step) return;
      event.preventDefault();
      if (isBranchingStep(step)) {
        requestDelete(step.id);
        return;
      }
      trackWorkflowEvent(WORKFLOW_CLIENT_EVENTS.nodeDeleted, { node_type: highlighted.data.nodeType });
      deleteNode(step.id);
      showUndoToast({
        message: t("workspace.workflows.step_deleted", { name: getNodeRegistryEntry(step).title(step, t) }),
        undoLabel: t("workspace.workflows.undo"),
        previous,
        store,
      });
    };
    globalThis.addEventListener("pointerdown", onPointerDown, true);
    globalThis.addEventListener("focusin", onFocusIn, true);
    globalThis.addEventListener("keydown", onKeyDown);
    return () => {
      globalThis.removeEventListener("pointerdown", onPointerDown, true);
      globalThis.removeEventListener("focusin", onFocusIn, true);
      globalThis.removeEventListener("keydown", onKeyDown);
    };
  }, [canMutate, canvasRef, deleteNode, requestDelete, store, t]);
};
