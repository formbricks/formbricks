"use client";

import { EdgeLabelRenderer, type Node, useNodesData } from "@xyflow/react";
import { atom, useAtomValue } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { useInsertWorkflowStepOnEdge } from "@/modules/ee/workflows/hooks/use-append-workflow-step";
import { useStepClipboard } from "@/modules/ee/workflows/hooks/use-step-clipboard";
import {
  type TWorkflowNodeData,
  canMutateCanvasAtom,
  stepMoveDragAtom,
} from "@/modules/ee/workflows/state/editor";
import { WorkflowAddStepMenu } from "./workflow-add-step-menu";

/** The line the pointer is over; the canvas sets it from ReactFlow's edge hover events. */
export const hoveredWorkflowEdgeIdAtom = atom<string | null>(null);

interface EdgeInsertButtonProps {
  edgeId: string;
  source: string;
  x: number;
  y: number;
}

// The `+` on a line between two steps: hovering the line shows it, and it opens the same step picker
// as the `+` at the end of a path, to insert a step between the two. It stays while the pointer is on
// it or its menu is open, and shows on keyboard focus, so the line's hover is not the only way in.
export const EdgeInsertButton = ({ edgeId, source, x, y }: Readonly<EdgeInsertButtonProps>) => {
  const { t } = useTranslation();
  const canMutate = useAtomValue(canMutateCanvasAtom);
  const isLineHovered = useAtomValue(hoveredWorkflowEdgeIdAtom) === edgeId;
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const sourceNode = useNodesData<Node<TWorkflowNodeData>>(source);
  const insertStep = useInsertWorkflowStepOnEdge();
  const { paste, canPasteAt } = useStepClipboard();
  // While a step card is dragged, every line's `+` shows where it can be dropped.
  const isMoveDragging = useAtomValue(stepMoveDragAtom) !== null;

  if (!canMutate) return null;
  const isVisible = isLineHovered || isHovered || isMenuOpen || isMoveDragging;

  return (
    <EdgeLabelRenderer>
      <div
        className={cn(
          "nodrag nopan pointer-events-auto absolute transition-opacity focus-within:opacity-100 motion-reduce:transition-none",
          isVisible ? "opacity-100" : "opacity-0"
        )}
        style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}>
        <WorkflowAddStepMenu
          afterNodeType={sourceNode?.data.nodeType ?? "unknown"}
          ariaLabel={t("workspace.workflows.insert_step")}
          onOpenChange={setIsMenuOpen}
          onAdd={(stepType) => insertStep(edgeId, source, stepType)}
          onPaste={canPasteAt({ edgeId }) ? () => paste({ edgeId }) : undefined}
          moveTarget={{ edgeId }}
        />
      </div>
    </EdgeLabelRenderer>
  );
};
