"use client";

import { BaseEdge, type EdgeProps, getStraightPath } from "@xyflow/react";
import { WORKFLOW_CANVAS_CONNECTOR } from "@/modules/ee/workflows/lib/canvas-geometry";
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

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: WORKFLOW_CANVAS_CONNECTOR.color,
          strokeWidth: WORKFLOW_CANVAS_CONNECTOR.width,
          ...style,
        }}
      />
      <EdgeInsertButton edgeId={id} source={source} x={midX} y={midY} />
    </>
  );
};
