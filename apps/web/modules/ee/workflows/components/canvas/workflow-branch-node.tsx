"use client";

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { useAtomValue, useSetAtom } from "jotai";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { TWorkflowIfElseBranch } from "@formbricks/workflows";
import { cn } from "@/lib/cn";
import {
  WORKFLOW_CANVAS_BRANCH_FORK_HEIGHT,
  WORKFLOW_CANVAS_BRANCH_SPREAD,
} from "@/modules/ee/workflows/lib/canvas-geometry";
import {
  type TWorkflowNodeData,
  appendSendEmailAfterNodeAtom,
  canMutateCanvasAtom,
} from "@/modules/ee/workflows/state/editor";
import { WorkflowAddStepMenu } from "./workflow-add-step-menu";
import { HANDLE_CLASS_NAMES, WorkflowNodeCard } from "./workflow-node-card";

// 2px slate-500 lines: 4.5:1 on the canvas, so the fork reads as a real path, unlike the faint
// connector between steps.
const FORK_LINE_CLASS_NAME = "absolute bg-slate-500";
// Where the stem meets the bar, from the top of the fork.
const FORK_BAR_TOP_PX = 20;

type TBranchLeg = {
  branch: TWorkflowIfElseBranch;
  label: string;
  ariaLabel: string;
  addStepLabel: string;
  side: "left" | "right";
};

/**
 * An If/else step on the canvas (ENG-7111): the step card, and under it a fork into a Then branch
 * (left) and an Else branch (right), each labelled at its start. A branch's edge to its first step
 * leaves from the end of its leg; a branch with no step yet ends in its own `+` there instead.
 */
export const WorkflowBranchNode = memo(
  ({ id, data, selected }: Readonly<NodeProps<Node<TWorkflowNodeData>>>) => {
    const { t } = useTranslation();
    const appendSendEmail = useSetAtom(appendSendEmailAfterNodeAtom);
    const canMutate = useAtomValue(canMutateCanvasAtom);
    const legs: TBranchLeg[] = [
      {
        branch: "then",
        label: t("workspace.workflows.branch_then"),
        ariaLabel: t("workspace.workflows.branch_then_aria"),
        addStepLabel: t("workspace.workflows.add_step_to_then_branch"),
        side: "left",
      },
      {
        branch: "else",
        label: t("workspace.workflows.branch_else"),
        ariaLabel: t("workspace.workflows.branch_else_aria"),
        addStepLabel: t("workspace.workflows.add_step_to_else_branch"),
        side: "right",
      },
    ];

    return (
      <div className="flex flex-col items-center">
        <WorkflowNodeCard data={data} selected={selected} />
        <div className="relative w-64" style={{ height: WORKFLOW_CANVAS_BRANCH_FORK_HEIGHT }}>
          {/* Wider than the card on purpose: the legs sit one column apart, over the branches. */}
          <div
            className="absolute inset-y-0 left-1/2 -translate-x-1/2"
            style={{ width: WORKFLOW_CANVAS_BRANCH_SPREAD + 2 }}>
            <div
              className={cn(FORK_LINE_CLASS_NAME, "top-0 left-1/2 w-0.5 -translate-x-1/2")}
              style={{ height: FORK_BAR_TOP_PX }}
            />
            <div className={cn(FORK_LINE_CLASS_NAME, "inset-x-0 h-0.5")} style={{ top: FORK_BAR_TOP_PX }} />
            {legs.map(({ branch, label, ariaLabel, addStepLabel, side }) => (
              <div
                key={branch}
                className={cn(FORK_LINE_CLASS_NAME, "bottom-0 w-0.5", side === "left" ? "left-0" : "right-0")}
                style={{ top: FORK_BAR_TOP_PX }}>
                <span className="absolute top-2 left-1/2 z-10 inline-flex -translate-x-1/2 items-center rounded-full border border-slate-500 bg-white px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-slate-900">
                  <span aria-hidden="true">{label}</span>
                  <span className="sr-only">{ariaLabel}</span>
                </span>
                <Handle id={branch} type="source" position={Position.Bottom} className={HANDLE_CLASS_NAMES} />
                {canMutate && data.emptyBranches.includes(branch) && (
                  <div className="absolute top-full left-1/2 mt-1 -translate-x-1/2">
                    <WorkflowAddStepMenu
                      afterNodeType={data.nodeType}
                      ariaLabel={addStepLabel}
                      onAddSendEmail={() => appendSendEmail(id, branch)}
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
