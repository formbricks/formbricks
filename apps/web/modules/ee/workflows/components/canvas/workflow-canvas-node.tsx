"use client";

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { useAtomValue, useSetAtom } from "jotai";
import { MoreVerticalIcon, Trash2Icon } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { useAppendWorkflowStep } from "@/modules/ee/workflows/hooks/use-append-workflow-step";
import { useStepClipboard } from "@/modules/ee/workflows/hooks/use-step-clipboard";
import { trackWorkflowEvent } from "@/modules/ee/workflows/lib/analytics";
import { WORKFLOW_CLIENT_EVENTS } from "@/modules/ee/workflows/lib/analytics-events";
import {
  type TWorkflowNodeData,
  canMutateCanvasAtom,
  cutWorkflowStepIdsAtom,
  deleteWorkflowNodeAtom,
  stepIdsMovingAlongAtom,
  workflowCanvasDirectionAtom,
} from "@/modules/ee/workflows/state/editor";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { InsertStepAfterMenuItem } from "./insert-step-after-menu-item";
import { MoveStepMenuItem } from "./move-step-menu-item";
import { StepClipboardMenuItems } from "./step-clipboard-menu-items";
import { WorkflowAddStepMenu } from "./workflow-add-step-menu";
import { HANDLE_CLASS_NAMES, WorkflowNodeCard } from "./workflow-node-card";

export const WorkflowCanvasNode = memo(
  ({ id, data, selected, dragging }: Readonly<NodeProps<Node<TWorkflowNodeData>>>) => {
    const { t } = useTranslation();
    const deleteNode = useSetAtom(deleteWorkflowNodeAtom);
    const appendStep = useAppendWorkflowStep();
    const canMutate = useAtomValue(canMutateCanvasAtom);
    const isTrigger = data.category === "trigger";
    const isHorizontal = useAtomValue(workflowCanvasDirectionAtom) === "horizontal";
    const cutStepIds = useAtomValue(cutWorkflowStepIdsAtom);
    // Steps a dragged If/else, Switch or Filter takes along look like a pending cut while it moves.
    const movingAlong = useAtomValue(stepIdsMovingAlongAtom);
    const { paste, canPasteAt } = useStepClipboard();

    return (
      <div className={cn("flex items-center", isHorizontal ? "flex-row" : "flex-col")}>
        <WorkflowNodeCard
          data={data}
          selected={selected}
          isCut={cutStepIds.has(id) || (movingAlong.has(id) && !dragging)}
          direction={isHorizontal ? "horizontal" : "vertical"}
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
                  <InsertStepAfterMenuItem nodeId={id} nodeType={data.nodeType} />
                  <MoveStepMenuItem nodeId={id} />
                  <StepClipboardMenuItems nodeId={id} />
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
          <Handle
            type="source"
            position={isHorizontal ? Position.Right : Position.Bottom}
            className={HANDLE_CLASS_NAMES}
          />
        </WorkflowNodeCard>
        {data.canAppendStep && canMutate && (
          // The end of the workflow or of an If/else branch gets an inline `+`; mid-chain edges
          // don't offer one. A path that ends on a step needs no end mark: the card is its end.
          <div className={cn("flex items-center gap-1", isHorizontal ? "ml-2 flex-row" : "mt-2 flex-col")}>
            <div className={isHorizontal ? "h-px w-3 bg-slate-300" : "h-3 w-px bg-slate-300"} />
            <WorkflowAddStepMenu
              afterNodeType={data.nodeType}
              ariaLabel={t("workspace.workflows.add_step")}
              onAdd={(stepType) => appendStep(id, stepType)}
              onPaste={canPasteAt({ sourceNodeId: id }) ? () => paste({ sourceNodeId: id }) : undefined}
              moveTarget={{ sourceNodeId: id }}
            />
          </div>
        )}
      </div>
    );
  }
);

WorkflowCanvasNode.displayName = "WorkflowCanvasNode";
