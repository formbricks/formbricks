"use client";

import {
  Background,
  BackgroundVariant,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  type OnNodesChange,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { CollapsedStepPill } from "@/modules/ee/workflows/components/inspector/workflow-inspector-panel";
import { useWorkflowEmailAuthoringContext } from "@/modules/ee/workflows/components/workflow-email-authoring-context";
import {
  WORKFLOW_CANVAS_MAX_ZOOM,
  useCanvasViewport,
} from "@/modules/ee/workflows/hooks/use-canvas-viewport";
import { useDeleteStepShortcut } from "@/modules/ee/workflows/hooks/use-delete-step-shortcut";
import { useEditorRunHighlight } from "@/modules/ee/workflows/hooks/use-editor-run-highlight";
import { useStepClipboardShortcuts } from "@/modules/ee/workflows/hooks/use-step-clipboard";
import { useStepMoveDrag } from "@/modules/ee/workflows/hooks/use-step-move";
import { useWorkflowWebhook } from "@/modules/ee/workflows/hooks/use-workflow-webhook";
import { resolveBoundTriggerSurvey } from "@/modules/ee/workflows/lib/bound-survey";
import { WORKFLOW_CANVAS_FIT_PADDING } from "@/modules/ee/workflows/lib/canvas-fit";
import { getSurveyChoiceLabels } from "@/modules/ee/workflows/lib/choice-conditions";
import {
  WORKFLOW_ADD_BUTTON_EDGE_TYPE,
  WORKFLOW_BRANCH_EDGE_TYPE,
  WORKFLOW_BRANCH_NODE_TYPE,
  WORKFLOW_CANVAS_NODE_TYPE,
  WORKFLOW_CANVAS_SNAP_GRID,
  haveSameNodePositions,
  reorganizeWorkflowDefinition,
  withBranchLegOffsets,
  workflowDefinitionToFlowEdges,
  workflowDefinitionToFlowNodes,
} from "@/modules/ee/workflows/lib/definition-to-flow";
import { isEdgeOffRunPath } from "@/modules/ee/workflows/lib/run-canvas-highlight";
import { getSurveyVariableLabels, getSurveyVariableRefs } from "@/modules/ee/workflows/lib/variable-picker";
import { countUsableVariables } from "@/modules/ee/workflows/lib/webhook-trigger-panel";
import { hasSavedWebhookTrigger } from "@/modules/ee/workflows/lib/workflow-samples";
import {
  type TWorkflowNodeData,
  addWorkflowTriggerAtom,
  closeWorkflowNodeConfigModalAtom,
  hasBoundTriggerSurveyAtom,
  isCanvasLockedAtom,
  isWorkflowInspectorCollapsedAtom,
  isWorkflowNodeConfigModalOpenAtom,
  isWorkflowReadOnlyAtom,
  isWorkflowSnapToCanvasEnabledAtom,
  openWorkflowNodeConfigModalAtom,
  selectedWorkflowNodeIdAtom,
  setWorkflowDefinitionAtom,
  stepMoveDragAtom,
  workflowAtom,
  workflowCanvasDirectionAtom,
  workflowDefinitionAtom,
  workflowFlowNodesAtom,
} from "@/modules/ee/workflows/state/editor";
import { AddButtonEdge } from "./add-button-edge";
import { BranchEdge } from "./branch-edge";
import { CanvasControls } from "./canvas-controls";
import { hoveredWorkflowEdgeIdAtom } from "./edge-insert-button";
import { StepMoveOrigin } from "./step-move-origin";
import { WorkflowAddTriggerPicker } from "./workflow-add-trigger-picker";
import { WorkflowBranchNode } from "./workflow-branch-node";
import { WorkflowCanvasNode } from "./workflow-canvas-node";
import "./workflow-canvas.css";
import { WorkflowValidationStatus } from "./workflow-validation-status";

const NODE_TYPES: NodeTypes = {
  [WORKFLOW_CANVAS_NODE_TYPE]: WorkflowCanvasNode,
  [WORKFLOW_BRANCH_NODE_TYPE]: WorkflowBranchNode,
};

const EDGE_TYPES: EdgeTypes = {
  [WORKFLOW_ADD_BUTTON_EDGE_TYPE]: AddButtonEdge,
  [WORKFLOW_BRANCH_EDGE_TYPE]: BranchEdge,
};

interface WorkflowCanvasProps {
  isEditable: boolean;
}

const WorkflowCanvasContent = ({ isEditable }: Readonly<WorkflowCanvasProps>) => {
  const { t } = useTranslation();
  const workflow = useAtomValue(workflowAtom);
  const definition = useAtomValue(workflowDefinitionAtom);
  const flowNodes = useAtomValue(workflowFlowNodesAtom);
  const stepMoveDragState = useAtomValue(stepMoveDragAtom);
  const isSnapToCanvasEnabled = useAtomValue(isWorkflowSnapToCanvasEnabledAtom);
  const isLocked = useAtomValue(isCanvasLockedAtom);
  const setLocked = useSetAtom(isCanvasLockedAtom);
  const direction = useAtomValue(workflowCanvasDirectionAtom);
  const isInspectorCollapsed = useAtomValue(isWorkflowInspectorCollapsedAtom);
  const isNodeConfigOpen = useAtomValue(isWorkflowNodeConfigModalOpenAtom);
  const selectedNodeId = useAtomValue(selectedWorkflowNodeIdAtom);
  const closeNodeConfig = useSetAtom(closeWorkflowNodeConfigModalAtom);
  const setHoveredEdgeId = useSetAtom(hoveredWorkflowEdgeIdAtom);
  useStepClipboardShortcuts();
  const setDefinition = useSetAtom(setWorkflowDefinitionAtom);
  const setFlowNodes = useSetAtom(workflowFlowNodesAtom);
  const openNodeConfigModal = useSetAtom(openWorkflowNodeConfigModalAtom);
  const addTrigger = useSetAtom(addWorkflowTriggerAtom);
  const canvasRef = useRef<HTMLDivElement>(null);
  useDeleteStepShortcut(canvasRef);
  // `isEditable` (canEditDefinition) is the API-side gate. The drag/pointer mode toggle is the
  // user-driven gate layered on top: even when permissions allow editing, the canvas stays
  // non-mutable until the user switches to pointer mode.
  const canMutate = isEditable && !isLocked;
  // Shared by the picker overlay and the validation chip: while the centered add-trigger picker
  // is the canvas's main event, the chip would only restate it ("1 problem: no trigger"), so the
  // two are mutually exclusive by construction.
  const isTriggerPickerVisible = Boolean(definition && !definition.trigger && isEditable);

  // Shared flag owned by the builder page (server context OR workspace survey-list membership),
  // so a just-picked survey clears the node's setup flag immediately.
  const hasBoundSurvey = useAtomValue(hasBoundTriggerSurveyAtom);
  // Unloaded state defaults to draft so a fresh page never flashes red before the workflow lands.
  const isDraft = workflow ? workflow.status === "draft" : true;

  // A Webhook trigger's card says whether a sample arrived ("Sample received · 9 Variables"). Only
  // members who can edit read the webhook; the others keep the card's general summary.
  const isReadOnly = useAtomValue(isWorkflowReadOnlyAtom);
  const webhook = useWorkflowWebhook({
    workflowId: workflow?.id ?? null,
    enabled: hasSavedWebhookTrigger(workflow) && !isReadOnly,
  });
  const webhookSample = definition?.trigger?.triggerType === "webhook" ? webhook.data?.sample : null;
  const triggerSummary = webhookSample
    ? t("workspace.workflows.webhook_trigger_summary_sample", {
        count: countUsableVariables(webhookSample.variables),
      })
    : undefined;

  // Summaries name survey answers by their question, never by its id (`response.<questionId>`).
  const authoringContext = useWorkflowEmailAuthoringContext();
  const boundSurvey = resolveBoundTriggerSurvey(authoringContext, definition);
  const variableLabels = useMemo(() => getSurveyVariableLabels(boundSurvey, t), [boundSurvey, t]);
  const variableRefs = useMemo(() => getSurveyVariableRefs(boundSurvey, t), [boundSurvey, t]);
  const choiceLabels = useMemo(() => getSurveyChoiceLabels(boundSurvey), [boundSurvey]);

  const derivedFlowNodes = useMemo(
    () =>
      definition
        ? workflowDefinitionToFlowNodes(definition, t, {
            hasBoundSurvey,
            isDraft,
            triggerSummary,
            variableLabels,
            variableRefs,
            choiceLabels,
            direction,
          })
        : [],
    [
      definition,
      t,
      hasBoundSurvey,
      isDraft,
      triggerSummary,
      variableLabels,
      variableRefs,
      choiceLabels,
      direction,
    ]
  );
  // While a run is open in the run drawer, the canvas marks its path: the steps and edges off it
  // are greyed (mock screen 7), and each If/else labels the branch it took (workflow-branch-node).
  const runHighlight = useEditorRunHighlight();
  const flowEdges = useMemo(() => {
    const edges = definition ? workflowDefinitionToFlowEdges(definition) : [];
    if (!runHighlight) return edges;
    return edges.map((edge) =>
      isEdgeOffRunPath(edge, runHighlight) ? { ...edge, style: { ...edge.style, opacity: 0.35 } } : edge
    );
  }, [definition, runHighlight]);

  // The step whose panel is open. Its card is always the highlighted one, however the panel opened
  // (a click, a new step, the URL), so the panel and the canvas never disagree.
  const openNodeId = isNodeConfigOpen ? selectedNodeId : null;

  // Keep ReactFlow's nodes in sync with the projected definition while preserving the user's
  // current selection — recomputing from scratch would lose it on every definition edit.
  // Closing the panel clears the highlight once, so a card is never highlighted without its panel.
  const wasPanelOpenRef = useRef(false);
  useEffect(() => {
    const hasPanelClosed = wasPanelOpenRef.current && !openNodeId;
    wasPanelOpenRef.current = openNodeId !== null;
    setFlowNodes((currentNodes) => {
      const currentNodesById = new Map(currentNodes.map((node) => [node.id, node]));

      return derivedFlowNodes.map((node) => {
        let selected = currentNodesById.get(node.id)?.selected ?? node.selected;
        if (openNodeId) selected = node.id === openNodeId;
        else if (hasPanelClosed) selected = false;
        return { ...node, selected };
      });
    });
  }, [derivedFlowNodes, openNodeId, setFlowNodes]);

  // Each If/else and Switch puts its fork's legs right above its branches' steps, from where the
  // canvas has them now. While a card is dragged its legs stay put, so the `+` on them hold still.
  const definitionEdges = definition?.edges;
  const draggedStepId = stepMoveDragState?.stepId;
  const draggedFrom = stepMoveDragState?.start;
  const displayedFlowNodes = useMemo(() => {
    const frozen = draggedStepId && draggedFrom ? { id: draggedStepId, position: draggedFrom } : null;
    const nodes = withBranchLegOffsets(flowNodes, definitionEdges ?? [], direction, frozen);
    if (!runHighlight) return nodes;
    return nodes.map((node) =>
      runHighlight.notTakenStepIds.has(node.id)
        ? { ...node, className: cn(node.className, "opacity-40") }
        : node
    );
  }, [flowNodes, definitionEdges, runHighlight, direction, draggedStepId, draggedFrom]);

  const handleNodesChange: OnNodesChange<Node<TWorkflowNodeData>> = useCallback(
    (changes) => setFlowNodes((currentNodes) => applyNodeChanges(changes, currentNodes)),
    [setFlowNodes]
  );

  // Dragging a card onto a `+` moves its step there; anywhere else it stays where dropped (use-step-move).
  const stepMoveDrag = useStepMoveDrag(canvasRef);

  const isInspectorVisible = isNodeConfigOpen && !isInspectorCollapsed;
  const { handleFitView, recenterAfterLayout, refitAfterLayout } = useCanvasViewport({
    canvasRef,
    openNodeId,
    isInspectorVisible,
  });

  const handleAutoLayout = useCallback(() => {
    if (!canMutate || !definition) return;
    // Says what happened, since a workflow that is already arranged doesn't visibly change. Nothing
    // moved means nothing to save and no undo step.
    const arranged = reorganizeWorkflowDefinition(definition, direction);
    if (haveSameNodePositions(definition, arranged)) {
      toast.success(t("workspace.workflows.auto_layout_unchanged"));
    } else {
      setDefinition((currentDefinition) =>
        currentDefinition ? reorganizeWorkflowDefinition(currentDefinition, direction) : currentDefinition
      );
      toast.success(t("workspace.workflows.auto_layout_done"));
    }
    recenterAfterLayout();
  }, [canMutate, definition, direction, setDefinition, recenterAfterLayout, t]);

  // The view first fits before React Flow has measured a left-to-right flow's wider layout: fit it
  // again once per workflow opened.
  const refitForDirectionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!workflow?.id || !definition || refitForDirectionRef.current === workflow.id) return;
    refitForDirectionRef.current = workflow.id;
    if (direction === "horizontal") refitAfterLayout();
  }, [workflow?.id, definition, direction, refitAfterLayout]);

  // Switching the orientation re-arranges every step for it: positions laid out top to bottom
  // would read wrong left to right. Saved with the workflow and undone like Auto layout.
  const handleToggleDirection = useCallback(() => {
    if (!canMutate) return;
    const next = direction === "vertical" ? "horizontal" : "vertical";
    // One edit: the orientation and the positions laid out for it, so Undo restores both.
    setDefinition((currentDefinition) =>
      currentDefinition
        ? {
            ...reorganizeWorkflowDefinition(currentDefinition, next),
            ui: { ...currentDefinition.ui, direction: next },
          }
        : currentDefinition
    );
    toast.success(
      next === "horizontal"
        ? t("workspace.workflows.canvas_direction_horizontal_done")
        : t("workspace.workflows.canvas_direction_vertical_done")
    );
    recenterAfterLayout();
  }, [canMutate, direction, setDefinition, recenterAfterLayout, t]);

  // Pan mode is the pan/browse tool: nodes are fully inert (no click, selection, or drag), so
  // switching into it also clears any leftover selection. Pointer mode is the select/inspect
  // tool and is available to everyone — mutations stay gated by status/permissions (canMutate).
  const handlePanMode = () => {
    setLocked(true);
    setFlowNodes((currentNodes) =>
      currentNodes.map((node) => (node.selected ? { ...node, selected: false } : node))
    );
  };

  const handlePointerMode = () => setLocked(false);

  return (
    <div
      ref={canvasRef}
      className={cn(
        // Height comes from the editor row (see workflow-builder-page); `min-h-0` lets this shrink
        // to it instead of being sized by ReactFlow's content. `overflow-hidden` is the canvas's own
        // scroll policy: it pans and zooms, so clipping is correct here.
        "relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white"
      )}>
      <ReactFlow
        nodes={displayedFlowNodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={handleNodesChange}
        onNodeDragStart={stepMoveDrag.onNodeDragStart}
        onNodeDrag={stepMoveDrag.onNodeDrag}
        onNodeDragStop={stepMoveDrag.onNodeDragStop}
        // A click that wobbles a little still opens the step instead of starting a move.
        nodeDragThreshold={4}
        onNodeClick={(_event, node) => {
          if (!isLocked) openNodeConfigModal(node.id);
        }}
        // Clicking empty canvas deselects (ReactFlow) and dismisses the node inspector — with
        // Settings gone this is the natural way out of a node's config view.
        onPaneClick={() => closeNodeConfig()}
        // The line under the pointer shows its `+` to insert a step (EdgeInsertButton).
        onEdgeMouseEnter={(_event, edge) => setHoveredEdgeId(edge.id)}
        onEdgeMouseLeave={() => setHoveredEdgeId(null)}
        // Mode-dependent cursor + hit-testing rules live in workflow-canvas.css, keyed off
        // these classes (Tailwind can't express `.react-flow__node` — underscores in arbitrary
        // selectors turn into spaces).
        className={cn("workflow-canvas bg-slate-50", isLocked && "pan-mode")}
        fitView
        fitViewOptions={{
          padding: WORKFLOW_CANVAS_FIT_PADDING,
          maxZoom: WORKFLOW_CANVAS_MAX_ZOOM,
          minZoom: 0.4,
        }}
        defaultViewport={{ x: 0, y: 0, zoom: WORKFLOW_CANVAS_MAX_ZOOM }}
        nodesDraggable={canMutate}
        // React Flow's delete key only drops the card from local flowNodes, never from the definition,
        // so the step came back on the next redraw. Backspace/Delete delete the step through the
        // definition instead (useDeleteStepShortcut). `null` disables the shortcut in RF 12.
        deleteKeyCode={null}
        nodesConnectable={false}
        snapGrid={WORKFLOW_CANVAS_SNAP_GRID}
        snapToGrid={isSnapToCanvasEnabled}
        proOptions={{ hideAttribution: true }}
        elementsSelectable={!isLocked}
        nodesFocusable={!isLocked}>
        {/* Same dot grid the pre-ReactFlow mockup used: radial-gradient(#cbd5e1 1px) on an 18px grid. */}
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.5} color="#cbd5e1" />
        <StepMoveOrigin />
      </ReactFlow>
      {/* Empty drafts start with no nodes: the centered picker is how the trigger gets added.
          Gated on status-based editability (not the layout lock) — adding nodes is a content
          edit, same as the node config forms. */}
      {isTriggerPickerVisible && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="pointer-events-auto">
            <WorkflowAddTriggerPicker onSelect={addTrigger} />
          </div>
        </div>
      )}
      <CanvasControls
        canMutate={canMutate}
        isPanMode={isLocked}
        direction={direction}
        onAutoLayout={handleAutoLayout}
        onFitView={handleFitView}
        onToggleDirection={handleToggleDirection}
        onPanMode={handlePanMode}
        onPointerMode={handlePointerMode}
      />
      {/* Always-on live validation state (replaces the former manual "Validate" dry-run button):
          a passive badge while valid, a button listing the problems while not. Suppressed while
          the add-trigger picker is up so a fresh draft isn't greeted with a problem count. */}
      {!isTriggerPickerVisible && <WorkflowValidationStatus />}
      {/* The collapsed step panel stays as a pill at the canvas's top-right (review point 5). */}
      {isNodeConfigOpen && isInspectorCollapsed ? <CollapsedStepPill /> : null}
    </div>
  );
};

export const WorkflowCanvas = (props: Readonly<WorkflowCanvasProps>) => (
  <ReactFlowProvider>
    <WorkflowCanvasContent {...props} />
  </ReactFlowProvider>
);
