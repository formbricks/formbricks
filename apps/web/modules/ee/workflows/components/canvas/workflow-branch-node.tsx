"use client";

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { MoreVerticalIcon, Trash2Icon } from "lucide-react";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { useAppendWorkflowStep } from "@/modules/ee/workflows/hooks/use-append-workflow-step";
import { useEditorRunHighlight } from "@/modules/ee/workflows/hooks/use-editor-run-highlight";
import { trackWorkflowEvent } from "@/modules/ee/workflows/lib/analytics";
import { WORKFLOW_CLIENT_EVENTS } from "@/modules/ee/workflows/lib/analytics-events";
import {
  WORKFLOW_CANVAS_BRANCH_FORK_HEIGHT,
  WORKFLOW_CANVAS_BRANCH_SPREAD,
} from "@/modules/ee/workflows/lib/canvas-geometry";
import {
  type TWorkflowNodeData,
  canMutateCanvasAtom,
  countStepsOnBranches,
  deleteWorkflowNodeAtom,
  workflowDefinitionAtom,
} from "@/modules/ee/workflows/state/editor";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { WorkflowAddStepMenu } from "./workflow-add-step-menu";
import { HANDLE_CLASS_NAMES, WorkflowNodeCard } from "./workflow-node-card";

// 2px slate-500 lines: 4.5:1 on the canvas, so the fork reads as a real path, unlike the faint
// connector between steps.
const FORK_LINE_CLASS_NAME = "absolute bg-slate-500";
// Where the stem meets the bar, from the top of the fork.
const FORK_BAR_TOP_PX = 20;

/**
 * An If/else or Switch step on the canvas (ENG-7111, ENG-7157): the step card, and under it a fork
 * into its branches, one column apart, each labelled at its start with a plain label (ED8: Then and
 * Else, or each case's name and Default). A branch's edge to its first step leaves from the end of
 * its leg; a branch with no step yet ends in its own `+` there instead.
 */
export const WorkflowBranchNode = memo(
  ({ id, data, selected }: Readonly<NodeProps<Node<TWorkflowNodeData>>>) => {
    const { t } = useTranslation();
    const appendStep = useAppendWorkflowStep();
    const deleteNode = useSetAtom(deleteWorkflowNodeAtom);
    const store = useStore();
    const canMutate = useAtomValue(canMutateCanvasAtom);
    // While a run is open in the run drawer: the branch it took, filled; the other one greyed.
    const takenBranch = useEditorRunHighlight()?.takenBranchByStepId[id] ?? null;
    // Deleting an If/else or a Switch takes its branches with it (spec §2), so it asks first, saying how many
    // steps go too. Counted when the menu item is picked, not on every render of the card.
    const [deleteStepCount, setDeleteStepCount] = useState<number | null>(null);
    const legs = data.branches;
    const isSwitch = data.nodeType === "switch";
    // Inline literal t() calls so the translation-key scanner detects the keys.
    const deleteTitle = isSwitch
      ? t("workspace.workflows.delete_switch_title")
      : t("workspace.workflows.delete_if_else_title");
    let deleteBody = t("workspace.workflows.delete_if_else_body_empty");
    if (isSwitch) {
      deleteBody = deleteStepCount
        ? t("workspace.workflows.delete_switch_body", { count: deleteStepCount })
        : t("workspace.workflows.delete_switch_body_empty");
    } else if (deleteStepCount) {
      deleteBody = t("workspace.workflows.delete_if_else_body", { count: deleteStepCount });
    }

    return (
      <div className="flex flex-col items-center">
        <WorkflowNodeCard
          data={data}
          selected={selected}
          menu={
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
                      const definition = store.get(workflowDefinitionAtom);
                      setDeleteStepCount(definition ? countStepsOnBranches(definition, id) : 0);
                    }}>
                    <Trash2Icon className="size-4" />
                    {t("common.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          }
        />
        {/* The dialog is portalled, but its clicks still bubble through React to this card, which would
            open the step's panel; stop them here. */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div onClick={(event) => event.stopPropagation()}>
          <ConfirmationModal
            open={deleteStepCount !== null}
            setOpen={(open) => {
              if (!open) setDeleteStepCount(null);
            }}
            title={deleteTitle}
            body={deleteBody}
            buttonText={t("common.delete")}
            buttonVariant="destructive"
            onConfirm={() => {
              trackWorkflowEvent(WORKFLOW_CLIENT_EVENTS.nodeDeleted, { node_type: data.nodeType });
              deleteNode(id);
              setDeleteStepCount(null);
            }}
            Icon={Trash2Icon}
          />
        </div>
        <div className="relative w-64" style={{ height: WORKFLOW_CANVAS_BRANCH_FORK_HEIGHT }}>
          {/* Wider than the card on purpose: the legs sit one column apart, over the branches. */}
          <div
            className="absolute inset-y-0 left-1/2 -translate-x-1/2"
            style={{ width: WORKFLOW_CANVAS_BRANCH_SPREAD * (legs.length - 1) + 2 }}>
            <div
              className={cn(FORK_LINE_CLASS_NAME, "top-0 left-1/2 w-0.5 -translate-x-1/2")}
              style={{ height: FORK_BAR_TOP_PX }}
            />
            <div className={cn(FORK_LINE_CLASS_NAME, "inset-x-0 h-0.5")} style={{ top: FORK_BAR_TOP_PX }} />
            {legs.map(({ handle: branch, label, ariaLabel, addStepLabel }, index) => (
              <div
                key={branch}
                className={cn(
                  FORK_LINE_CLASS_NAME,
                  "bottom-0 w-0.5",
                  takenBranch !== null && takenBranch !== branch && "opacity-40"
                )}
                style={{ top: FORK_BAR_TOP_PX, left: index * WORKFLOW_CANVAS_BRANCH_SPREAD }}>
                <span
                  className={cn(
                    "absolute top-2 left-1/2 z-10 inline-flex max-w-[18rem] -translate-x-1/2 items-center rounded-full border border-slate-500 bg-white px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-slate-900",
                    takenBranch === branch && "border-slate-900 bg-slate-900 text-white"
                  )}>
                  <span aria-hidden="true" className="truncate">
                    {label}
                  </span>
                  <span className="sr-only">{ariaLabel}</span>
                  {takenBranch === branch ? (
                    <span className="sr-only">{t("workspace.workflows.run_branch_taken_aria")}</span>
                  ) : null}
                </span>
                <Handle id={branch} type="source" position={Position.Bottom} className={HANDLE_CLASS_NAMES} />
                {canMutate && data.emptyBranches.includes(branch) && (
                  <div className="absolute top-full left-1/2 mt-1 -translate-x-1/2">
                    <WorkflowAddStepMenu
                      afterNodeType={data.nodeType}
                      ariaLabel={addStepLabel}
                      onAdd={(stepType) => appendStep(id, stepType, branch)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
);

WorkflowBranchNode.displayName = "WorkflowBranchNode";
