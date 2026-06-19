"use client";

import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getStraightPath } from "@xyflow/react";
import { PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";

export const AddButtonEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
}: Readonly<EdgeProps>) => {
  const { t } = useTranslation();
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke: "#cbd5e1", strokeWidth: 1.5, ...style }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          className="nodrag nopan">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("workspace.workflows.add_step")}
            className="size-6 rounded-full bg-white"
            onClick={(event) => event.stopPropagation()}>
            <PlusIcon />
          </Button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
