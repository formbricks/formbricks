"use client";

import { BaseEdge, type EdgeProps, getStraightPath } from "@xyflow/react";

// The custom edge currently only renders the connector line. Inserting nodes mid-chain isn't
// supported yet — we cap workflows at one action after the trigger — so the `+` affordance
// lives on the trigger card itself (see workflow-canvas-node.tsx). When complex multi-step
// flows land, this is where the mid-edge insertion control should come back.
export const AddButtonEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
}: Readonly<EdgeProps>) => {
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{ stroke: "#cbd5e1", strokeWidth: 1.5, ...style }}
    />
  );
};
