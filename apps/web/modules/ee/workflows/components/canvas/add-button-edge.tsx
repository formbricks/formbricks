"use client";

import { BaseEdge, type EdgeProps, getStraightPath } from "@xyflow/react";
import { useAtomValue } from "jotai";
import { WORKFLOW_CANVAS_CONNECTOR } from "@/modules/ee/workflows/lib/canvas-geometry";
import { cutWorkflowStepIdsAtom } from "@/modules/ee/workflows/state/editor";
import { EdgeInsertButton } from "./edge-insert-button";

// The line between two steps. Hovering it offers a `+` at its middle to insert a step between them.
export const AddButtonEdge = ({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
}: Readonly<EdgeProps>) => {
  const [edgePath, midX, midY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const isCut = useAtomValue(cutWorkflowStepIdsAtom).has(source);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: WORKFLOW_CANVAS_CONNECTOR.color,
          strokeWidth: WORKFLOW_CANVAS_CONNECTOR.width,
          // Inside a pending cut: faded with its steps.
          ...(isCut ? { opacity: 0.4, strokeDasharray: "4 4" } : {}),
          ...style,
        }}
      />
      <EdgeInsertButton edgeId={id} source={source} x={midX} y={midY} />
    </>
  );
};
