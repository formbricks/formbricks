"use client";

import { type Node, type OnNodeDrag, useReactFlow } from "@xyflow/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { type RefObject, useCallback, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { showUndoToast } from "@/modules/ee/workflows/components/canvas/undo-toast";
import { snapWorkflowNodePosition, updateNodePosition } from "@/modules/ee/workflows/lib/definition-to-flow";
import { getNodeRegistryEntry } from "@/modules/ee/workflows/lib/node-registry";
import type { TPasteTarget } from "@/modules/ee/workflows/lib/step-clipboard";
import { getMoveTargetKey, getMoveTargets, getMovingStepIds } from "@/modules/ee/workflows/lib/step-move";
import {
  type TWorkflowNodeData,
  canMutateCanvasAtom,
  isWorkflowSnapToCanvasEnabledAtom,
  moveWorkflowStepAtom,
  setWorkflowDefinitionAtom,
  stepMoveDragAtom,
  workflowDefinitionAtom,
  workflowFlowNodesAtom,
} from "@/modules/ee/workflows/state/editor";

/** How close (in screen pixels) the pointer must come to a `+` for a drop to land on it. */
const DROP_RADIUS = 64;

/**
 * Moves a step to a `+` (lib/step-move.ts) and says so: "Moved “…”." with Undo, and a warning naming a
 * Variable the move put before the step it comes from. Shared by the drag and the ⋮ menu's "Move to…".
 */
export const useMoveStep = () => {
  const { t } = useTranslation();
  const store = useStore();
  const moveStep = useSetAtom(moveWorkflowStepAtom);

  return useCallback(
    (stepId: string, target: TPasteTarget): boolean => {
      const result = moveStep({ stepId, target });
      if (!result) return false;
      const titleOf = (id: string) => {
        const node = result.definition.nodes.find((item) => item.id === id);
        return node ? getNodeRegistryEntry(node).title(node, t) : id;
      };
      showUndoToast({
        message: t("workspace.workflows.step_moved", { name: titleOf(stepId) }),
        undoLabel: t("workspace.workflows.undo"),
        previous: result.previous,
        store,
      });
      const [broken] = result.brokenReferences;
      if (broken) {
        toast.error(
          t("workspace.workflows.step_move_breaks_variable", {
            step: titleOf(broken.readerId),
            variable: broken.field,
            source: titleOf(broken.sourceStepId),
          }),
          { duration: 8000 }
        );
      }
      return true;
    },
    [moveStep, store, t]
  );
};

/** The `+` whose centre is nearest the pointer, within the drop radius. */
const findHotTarget = (container: HTMLElement, x: number, y: number): string | null => {
  let hot: string | null = null;
  let nearest = DROP_RADIUS;
  for (const element of container.querySelectorAll<HTMLElement>("[data-step-move-target]")) {
    const rect = element.getBoundingClientRect();
    const distance = Math.hypot(x - (rect.left + rect.width / 2), y - (rect.top + rect.height / 2));
    if (distance < nearest) {
      nearest = distance;
      hot = element.dataset.stepMoveTarget ?? null;
    }
  }
  return hot;
};

const pointerOf = (event: { clientX: number; clientY: number }) => ({ x: event.clientX, y: event.clientY });

type TNodeDragHandler = OnNodeDrag<Node<TWorkflowNodeData>>;

/**
 * Dragging a step card onto a `+` moves the step there. While dragging, every `+` it can go to lights
 * up and the nearest reads "Move here"; the card's old place shows as a dashed outline. A drop anywhere
 * else places the card there (snapped to the grid when that is on), as dragging always did; Escape puts
 * it back. The trigger only places, and nothing drags while the canvas can't change.
 */
export const useStepMoveDrag = (canvasRef: RefObject<HTMLDivElement | null>) => {
  const store = useStore();
  const { screenToFlowPosition } = useReactFlow();
  const setDrag = useSetAtom(stepMoveDragAtom);
  const setFlowNodes = useSetAtom(workflowFlowNodesAtom);
  const setDefinition = useSetAtom(setWorkflowDefinitionAtom);
  const isDragging = useAtomValue(stepMoveDragAtom) !== null;
  const move = useMoveStep();
  // Where the dragged card started, to put it back; and whether Escape already cancelled this drag.
  const dragRef = useRef<{ stepId: string; start: { x: number; y: number }; isCancelled: boolean } | null>(
    null
  );
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  const putBack = useCallback(
    (drag: { stepId: string; start: { x: number; y: number } }) =>
      setFlowNodes((nodes) =>
        nodes.map((node) => (node.id === drag.stepId ? { ...node, position: drag.start } : node))
      ),
    [setFlowNodes]
  );

  const onNodeDragStart: TNodeDragHandler = useCallback(
    (event, node) => {
      const definition = store.get(workflowDefinitionAtom);
      const step = [definition?.trigger, ...(definition?.nodes ?? [])].find((item) => item?.id === node.id);
      if (!definition || !step || !store.get(canMutateCanvasAtom)) return;
      // React Flow starts the drag a few pixels in: the saved position is where the card was.
      const start = step.ui?.position ?? node.position;
      const card = canvasRef.current?.querySelector<HTMLElement>(
        `.react-flow__node[data-id="${CSS.escape(node.id)}"] [data-step-card]`
      );
      const rect = card?.getBoundingClientRect();
      const topLeft = rect ? screenToFlowPosition({ x: rect.left, y: rect.top }) : node.position;
      const bottomRight = rect
        ? screenToFlowPosition({ x: rect.right, y: rect.bottom })
        : { x: node.position.x + 256, y: node.position.y + 72 };
      dragRef.current = { stepId: node.id, start, isCancelled: false };
      pointerRef.current = pointerOf(event);
      setDrag({
        stepId: node.id,
        start,
        movingStepIds: new Set(getMovingStepIds(definition, node.id)),
        targetKeys: new Set(getMoveTargets(definition, node.id).map(getMoveTargetKey)),
        hotTargetKey: null,
        origin: {
          x: start.x + topLeft.x - node.position.x,
          y: start.y + topLeft.y - node.position.y,
          width: bottomRight.x - topLeft.x,
          height: bottomRight.y - topLeft.y,
        },
      });
    },
    [canvasRef, screenToFlowPosition, setDrag, store]
  );

  const onNodeDrag: TNodeDragHandler = useCallback(
    (event) => {
      const pointer = pointerOf(event);
      if (!canvasRef.current || !dragRef.current || dragRef.current.isCancelled) return;
      pointerRef.current = pointer;
      const hot = findHotTarget(canvasRef.current, pointer.x, pointer.y);
      setDrag((current) =>
        current && current.hotTargetKey !== hot ? { ...current, hotTargetKey: hot } : current
      );
    },
    [canvasRef, setDrag]
  );

  const onNodeDragStop: TNodeDragHandler = useCallback(
    (_event, node) => {
      const drag = dragRef.current;
      const hot = store.get(stepMoveDragAtom)?.hotTargetKey ?? null;
      setDrag(null);
      dragRef.current = null;
      if (!drag || drag.isCancelled) return;
      const definition = store.get(workflowDefinitionAtom);
      const target =
        hot && definition
          ? getMoveTargets(definition, drag.stepId).find((item) => getMoveTargetKey(item) === hot)
          : undefined;
      if (target && move(drag.stepId, target)) return;
      // Not on a `+`: the card stays where it was dropped.
      const position = store.get(isWorkflowSnapToCanvasEnabledAtom)
        ? snapWorkflowNodePosition(node.position)
        : node.position;
      setDefinition((current) => (current ? updateNodePosition(current, node.id, position) : current));
    },
    [move, setDefinition, setDrag, store]
  );

  // Escape cancels: the card goes back, and the drag ends as if the button were released.
  useEffect(() => {
    if (!isDragging) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const drag = dragRef.current;
      if (event.key !== "Escape" || !drag) return;
      event.preventDefault();
      drag.isCancelled = true;
      setDrag(null);
      const pointer = pointerRef.current;
      globalThis.dispatchEvent(
        new MouseEvent("mouseup", {
          bubbles: true,
          view: globalThis.window,
          clientX: pointer?.x,
          clientY: pointer?.y,
        })
      );
      // After the drag ends, which leaves the card where the pointer was.
      putBack(drag);
    };
    globalThis.addEventListener("keydown", onKeyDown, true);
    return () => globalThis.removeEventListener("keydown", onKeyDown, true);
  }, [isDragging, putBack, setDrag]);

  return { onNodeDragStart, onNodeDrag, onNodeDragStop };
};
