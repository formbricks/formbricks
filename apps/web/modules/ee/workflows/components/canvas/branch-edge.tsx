"use client";

import { BaseEdge, type EdgeProps, getSmoothStepPath } from "@xyflow/react";

// slate-500, as the If/else fork it continues (see workflow-branch-node.tsx).
const BRANCH_EDGE_STROKE = "#64748b";

// The edge from the end of an If/else leg to the first step of that branch. Straight down when the
// layout put the step under its leg; right angles, like the fork above it, when a nested branch
// pushed the step further out or the user dragged it.
export const BranchEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
}: Readonly<EdgeProps>) => {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 0,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{ stroke: BRANCH_EDGE_STROKE, strokeWidth: 2, ...style }}
    />
  );
};
