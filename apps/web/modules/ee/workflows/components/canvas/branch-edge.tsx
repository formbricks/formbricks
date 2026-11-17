"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  type Node,
  getStraightPath,
  useNodesData,
} from "@xyflow/react";
import { useAtomValue } from "jotai";
import { useEditorRunHighlight } from "@/modules/ee/workflows/hooks/use-editor-run-highlight";
import { WORKFLOW_CANVAS_CONNECTOR } from "@/modules/ee/workflows/lib/canvas-geometry";
import {
  type TWorkflowNodeData,
  cutWorkflowStepIdsAtom,
  workflowCanvasDirectionAtom,
} from "@/modules/ee/workflows/state/editor";
import { BranchLabel } from "./branch-label";
import { EdgeInsertButton } from "./edge-insert-button";

// The edge from an If/else's or a Switch's fork bar to the first step of one of its branches. The
// canvas puts the branch's leg right above that step (withBranchLegOffsets), so the line runs straight
// down, drawn like every other connector, with the branch's label centred on it. Hovering it offers a
// `+` between the label and the step, to insert a step at the start of the branch.
export const BranchEdge = ({
  id,
  source,
  sourceHandleId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
}: Readonly<EdgeProps>) => {
  const [edgePath, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const sourceNode = useNodesData<Node<TWorkflowNodeData>>(source);
  const branch = sourceNode?.data.branches.find(({ handle }) => handle === sourceHandleId);
  // While a run is open in the run drawer: the branch it took, filled; the others greyed.
  const takenBranch = useEditorRunHighlight()?.takenBranchByStepId[source] ?? null;
  const isHorizontal = useAtomValue(workflowCanvasDirectionAtom) === "horizontal";
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
      {branch ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>
            <BranchLabel
              branch={branch}
              isTaken={takenBranch === branch.handle}
              isDimmed={takenBranch !== null && takenBranch !== branch.handle}
              isCompact={isHorizontal}
            />
          </div>
        </EdgeLabelRenderer>
      ) : null}
      <EdgeInsertButton edgeId={id} source={source} x={(labelX + targetX) / 2} y={(labelY + targetY) / 2} />
    </>
  );
};
