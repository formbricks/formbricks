"use client";

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { useAtomValue, useSetAtom } from "jotai";
import { MoreVerticalIcon, Trash2Icon } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useAppendWorkflowStep } from "@/modules/ee/workflows/hooks/use-append-workflow-step";
import { trackWorkflowEvent } from "@/modules/ee/workflows/lib/analytics";
import { WORKFLOW_CLIENT_EVENTS } from "@/modules/ee/workflows/lib/analytics-events";
import {
  type TWorkflowNodeData,
  canMutateCanvasAtom,
  deleteWorkflowNodeAtom,
} from "@/modules/ee/workflows/state/editor";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { WorkflowAddStepMenu } from "./workflow-add-step-menu";
import { HANDLE_CLASS_NAMES, WorkflowNodeCard } from "./workflow-node-card";

export const WorkflowCanvasNode = memo(
  ({ id, data, selected }: Readonly<NodeProps<Node<TWorkflowNodeData>>>) => {
    const { t } = useTranslation();
    const deleteNode = useSetAtom(deleteWorkflowNodeAtom);
    const appendStep = useAppendWorkflowStep();
    const canMutate = useAtomValue(canMutateCanvasAtom);
    const isTrigger = data.category === "trigger";

    return (
      <div className="flex flex-col items-center">
        <WorkflowNodeCard
          data={data}
          selected={selected}
          menu={
            !isTrigger &&
            canMutate && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("workspace.workflows.node_actions")}
                    className="size-6"
                    onClick={(event) => event.stopPropagation()}>
                    <MoreVerticalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="motion-reduce:animate-none">
                  <DropdownMenuItem
                    onClick={(event) => {
                      event.stopPropagation();
                      trackWorkflowEvent(WORKFLOW_CLIENT_EVENTS.nodeDeleted, { node_type: data.nodeType });
                      deleteNode(id);
                    }}>
                    <Trash2Icon className="size-4" />
                    {t("common.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          }>
          <Handle type="source" position={Position.Bottom} className={HANDLE_CLASS_NAMES} />
        </WorkflowNodeCard>
        {data.canAppendStep && canMutate && (
          // The end of the workflow or of an If/else branch gets an inline `+`; mid-chain edges
          // don't offer one.
          <div className="mt-2 flex flex-col items-center gap-1">
            <div className="h-3 w-px bg-slate-300" />
            <WorkflowAddStepMenu
              afterNodeType={data.nodeType}
              ariaLabel={t("workspace.workflows.add_step")}
              onAdd={(stepType) => appendStep(id, stepType)}
            />
          </div>
        )}
      </div>
    );
  }
);

WorkflowCanvasNode.displayName = "WorkflowCanvasNode";
