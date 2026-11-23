"use client";

import { Handle, type Node, type NodeProps, Position, useUpdateNodeInternals } from "@xyflow/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { MoreVerticalIcon, Trash2Icon } from "lucide-react";
import { type CSSProperties, memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { useAppendWorkflowStep } from "@/modules/ee/workflows/hooks/use-append-workflow-step";
import { useEditorRunHighlight } from "@/modules/ee/workflows/hooks/use-editor-run-highlight";
import { useStepClipboard } from "@/modules/ee/workflows/hooks/use-step-clipboard";
import { trackWorkflowEvent } from "@/modules/ee/workflows/lib/analytics";
import { WORKFLOW_CLIENT_EVENTS } from "@/modules/ee/workflows/lib/analytics-events";
import {
  WORKFLOW_CANVAS_BRANCH_FORK_BAR_TOP,
  WORKFLOW_CANVAS_BRANCH_ROW_HEIGHT,
  WORKFLOW_CANVAS_CONNECTOR,
  WORKFLOW_CANVAS_HORIZONTAL,
  getBranchLegOffsets,
  getBranchSpread,
} from "@/modules/ee/workflows/lib/canvas-geometry";
import {
  type TWorkflowNodeData,
  canMutateCanvasAtom,
  countStepsOnBranches,
  cutWorkflowStepIdsAtom,
  deleteWorkflowNodeAtom,
  stepDeleteRequestAtom,
  stepIdsMovingAlongAtom,
  workflowCanvasDirectionAtom,
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
import { BranchEndMarker } from "./branch-end-marker";
import { BranchLabel } from "./branch-label";
import { MoveStepMenuItem } from "./move-step-menu-item";
import { StepClipboardMenuItems } from "./step-clipboard-menu-items";
import { WorkflowAddStepMenu } from "./workflow-add-step-menu";
import { HANDLE_CLASS_NAMES, WorkflowNodeCard } from "./workflow-node-card";

// The fork's lines are drawn like every connector on the canvas (see WORKFLOW_CANVAS_CONNECTOR).
const FORK_LINE_CLASS_NAME = "absolute";
const VERTICAL_LINE_STYLE: CSSProperties = {
  width: WORKFLOW_CANVAS_CONNECTOR.width,
  background: WORKFLOW_CANVAS_CONNECTOR.color,
  transform: "translateX(-50%)",
};
const HORIZONTAL_LINE_STYLE: CSSProperties = {
  height: WORKFLOW_CANVAS_CONNECTOR.width,
  background: WORKFLOW_CANVAS_CONNECTOR.color,
  transform: "translateY(-50%)",
};
const { forkBarLeft: FORK_BAR_LEFT } = WORKFLOW_CANVAS_HORIZONTAL;

/**
 * An If/else or Switch step on the canvas (ENG-7111, ENG-7157): the step card, and under it a fork
 * bar with one leg per branch, right above the branch's first step (withBranchLegOffsets). A branch's
 * edge runs straight down from its leg on the bar and carries its plain label (ED8: Then and Else, or
 * each case's name and Default, see BranchEdge). A branch with no step yet gets its own line down to
 * its `+` instead, labelled the same way. The node is one branch row tall, so that `+` sits where the
 * branch's first step will go.
 */
export const WorkflowBranchNode = memo(
  ({ id, data, selected, dragging }: Readonly<NodeProps<Node<TWorkflowNodeData>>>) => {
    const { t } = useTranslation();
    const appendStep = useAppendWorkflowStep();
    const deleteNode = useSetAtom(deleteWorkflowNodeAtom);
    const cutStepIds = useAtomValue(cutWorkflowStepIdsAtom);
    // Steps a dragged If/else, Switch or Filter takes along look like a pending cut while it moves.
    const movingAlong = useAtomValue(stepIdsMovingAlongAtom);
    const { paste, canPasteAt } = useStepClipboard();
    const store = useStore();
    const canMutate = useAtomValue(canMutateCanvasAtom);
    // While a run is open in the run drawer: the branch it took, filled; the other one greyed.
    const takenBranch = useEditorRunHighlight()?.takenBranchByStepId[id] ?? null;
    // Deleting an If/else or a Switch takes its branches with it (spec §2), so it asks first, saying how many
    // steps go too. Counted when the menu item is picked, not on every render of the card.
    const [deleteStepCount, setDeleteStepCount] = useState<number | null>(null);
    // Backspace or Delete on this card (use-delete-step-shortcut) asks the same.
    const deleteRequest = useAtomValue(stepDeleteRequestAtom);
    const setDeleteRequest = useSetAtom(stepDeleteRequestAtom);
    useEffect(() => {
      if (deleteRequest !== id) return;
      setDeleteRequest(null);
      const definition = store.get(workflowDefinitionAtom);
      setDeleteStepCount(definition ? countStepsOnBranches(definition, id) : 0);
    }, [deleteRequest, id, setDeleteRequest, store]);
    const isHorizontal = useAtomValue(workflowCanvasDirectionAtom) === "horizontal";
    const legs = data.branches;
    const legOffsets =
      data.legOffsets ??
      getBranchLegOffsets(
        legs.map(() => null),
        getBranchSpread(isHorizontal ? "horizontal" : "vertical")
      );
    const barLeft = Math.min(0, ...legOffsets);
    const barRight = Math.max(0, ...legOffsets);
    // The legs' handles move with the branches' steps, which doesn't resize the node: tell React Flow
    // to measure them again so each edge starts at its leg.
    const updateNodeInternals = useUpdateNodeInternals();
    const legOffsetsKey = legOffsets.join(",");
    useEffect(() => {
      updateNodeInternals(id);
    }, [id, legOffsetsKey, updateNodeInternals]);
    // The node keeps its size while its card changes height (no ⋮ menu outside editing lets the
    // summary fit one line, a problem adds one), which moves the fork and its legs inside it. React
    // Flow only re-measures handles when the node resizes, so watch the card and measure again.
    const nodeRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      const card = nodeRef.current?.firstElementChild;
      if (!card || typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver(() => updateNodeInternals(id));
      observer.observe(card);
      return () => observer.disconnect();
    }, [id, updateNodeInternals]);
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
      <div
        ref={nodeRef}
        className={cn("flex", isHorizontal ? "flex-row items-start" : "flex-col items-center")}
        style={
          isHorizontal
            ? { width: WORKFLOW_CANVAS_HORIZONTAL.branchStepWidth }
            : { height: WORKFLOW_CANVAS_BRANCH_ROW_HEIGHT }
        }>
        <WorkflowNodeCard
          data={data}
          selected={selected}
          isCut={cutStepIds.has(id) || (movingAlong.has(id) && !dragging)}
          direction={isHorizontal ? "horizontal" : "vertical"}
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
                  <MoveStepMenuItem nodeId={id} />
                  <StepClipboardMenuItems nodeId={id} />
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
        {isHorizontal ? (
          // Left to right: the fork sits right of the card, its bar running down, and each leg runs
          // right from the bar, level with its branch's first step.
          <div
            className="pointer-events-none relative flex-1"
            style={{ height: WORKFLOW_CANVAS_HORIZONTAL.cardHeight }}>
            {/* Zero-height origin at the card's vertical centre, on its right edge. */}
            <div className="absolute inset-x-0 top-1/2 h-0">
              <div
                className="absolute left-0"
                style={{ ...HORIZONTAL_LINE_STYLE, top: 0, width: FORK_BAR_LEFT }}
              />
              <div
                className="absolute"
                style={{
                  left: FORK_BAR_LEFT,
                  top: barLeft,
                  height: barRight - barLeft,
                  width: WORKFLOW_CANVAS_CONNECTOR.width,
                  background: WORKFLOW_CANVAS_CONNECTOR.color,
                  transform: "translateX(-50%)",
                }}
              />
              {legs.map((branch, index) => {
                const top = legOffsets[index];
                const isEmpty = data.emptyBranches.includes(branch.handle);
                return (
                  <div key={branch.handle}>
                    <div className="absolute size-0" style={{ top, left: FORK_BAR_LEFT }}>
                      <Handle
                        id={branch.handle}
                        type="source"
                        position={Position.Right}
                        className={HANDLE_CLASS_NAMES}
                      />
                    </div>
                    {isEmpty ? (
                      <div
                        className={cn(
                          "absolute right-0",
                          takenBranch !== null && takenBranch !== branch.handle && "opacity-40"
                        )}
                        style={{ ...HORIZONTAL_LINE_STYLE, top, left: FORK_BAR_LEFT }}>
                        <div className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                          <BranchLabel
                            branch={branch}
                            isTaken={takenBranch === branch.handle}
                            isDimmed={false}
                            isCompact
                          />
                        </div>
                        {canMutate ? (
                          <div className="pointer-events-auto absolute top-1/2 left-full ml-1 -translate-y-1/2">
                            <WorkflowAddStepMenu
                              afterNodeType={data.nodeType}
                              ariaLabel={branch.addStepLabel}
                              onAdd={(stepType) => appendStep(id, stepType, branch.handle)}
                              onPaste={
                                canPasteAt({ sourceNodeId: id, branch: branch.handle })
                                  ? () => paste({ sourceNodeId: id, branch: branch.handle })
                                  : undefined
                              }
                              moveTarget={{ sourceNodeId: id, branch: branch.handle }}
                            />
                          </div>
                        ) : (
                          <div className="absolute top-1/2 left-full -translate-y-1/2">
                            <BranchEndMarker direction="horizontal" />
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="pointer-events-none relative w-64 flex-1">
            {/* Zero-width origin at the card's centre; the bar and the legs reach past the card on purpose. */}
            <div className="absolute inset-y-0 left-1/2 w-0">
              <div
                className={cn(FORK_LINE_CLASS_NAME, "top-0 left-0")}
                style={{ ...VERTICAL_LINE_STYLE, height: WORKFLOW_CANVAS_BRANCH_FORK_BAR_TOP }}
              />
              <div
                className={FORK_LINE_CLASS_NAME}
                style={{
                  top: WORKFLOW_CANVAS_BRANCH_FORK_BAR_TOP,
                  left: barLeft,
                  width: barRight - barLeft,
                  height: WORKFLOW_CANVAS_CONNECTOR.width,
                  background: WORKFLOW_CANVAS_CONNECTOR.color,
                  transform: "translateY(-50%)",
                }}
              />
              {legs.map((branch, index) => {
                const left = legOffsets[index];
                const isEmpty = data.emptyBranches.includes(branch.handle);
                return (
                  <div key={branch.handle}>
                    {/* Where the branch's edge starts: on the bar, right above the branch's first step. */}
                    <div
                      className="absolute size-0"
                      style={{ top: WORKFLOW_CANVAS_BRANCH_FORK_BAR_TOP, left }}>
                      <Handle
                        id={branch.handle}
                        type="source"
                        position={Position.Bottom}
                        className={HANDLE_CLASS_NAMES}
                      />
                    </div>
                    {isEmpty ? (
                      <div
                        className={cn(
                          FORK_LINE_CLASS_NAME,
                          "bottom-0",
                          takenBranch !== null && takenBranch !== branch.handle && "opacity-40"
                        )}
                        style={{ ...VERTICAL_LINE_STYLE, top: WORKFLOW_CANVAS_BRANCH_FORK_BAR_TOP, left }}>
                        <div className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                          <BranchLabel
                            branch={branch}
                            isTaken={takenBranch === branch.handle}
                            isDimmed={false}
                          />
                        </div>
                        {canMutate ? (
                          <div className="pointer-events-auto absolute top-full left-1/2 mt-1 -translate-x-1/2">
                            <WorkflowAddStepMenu
                              afterNodeType={data.nodeType}
                              ariaLabel={branch.addStepLabel}
                              onAdd={(stepType) => appendStep(id, stepType, branch.handle)}
                              onPaste={
                                canPasteAt({ sourceNodeId: id, branch: branch.handle })
                                  ? () => paste({ sourceNodeId: id, branch: branch.handle })
                                  : undefined
                              }
                              moveTarget={{ sourceNodeId: id, branch: branch.handle }}
                            />
                          </div>
                        ) : (
                          // Nothing runs on this branch and nothing can be added here now: the line ends.
                          <div className="absolute top-full left-1/2 -translate-x-1/2">
                            <BranchEndMarker />
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }
);

WorkflowBranchNode.displayName = "WorkflowBranchNode";
