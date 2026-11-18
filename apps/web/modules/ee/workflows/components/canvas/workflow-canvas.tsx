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
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAtomValue, useSetAtom } from "jotai";
import { PanelLeftIcon, PanelRightOpenIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { useWorkflowEmailAuthoringContext } from "@/modules/ee/workflows/components/workflow-email-authoring-context";
import { useEditorRunHighlight } from "@/modules/ee/workflows/hooks/use-editor-run-highlight";
import { useStepClipboardShortcuts } from "@/modules/ee/workflows/hooks/use-step-clipboard";
import { useWorkflowWebhook } from "@/modules/ee/workflows/hooks/use-workflow-webhook";
import { resolveBoundTriggerSurvey } from "@/modules/ee/workflows/lib/bound-survey";
import {
  TEST_RUN_DRAWER_SELECTOR,
  WORKFLOW_CANVAS_FIT_PADDING,
  getCanvasFitPadding,
} from "@/modules/ee/workflows/lib/canvas-fit";
import { getSurveyChoiceLabels } from "@/modules/ee/workflows/lib/choice-conditions";
import {
  WORKFLOW_ADD_BUTTON_EDGE_TYPE,
  WORKFLOW_BRANCH_EDGE_TYPE,
  WORKFLOW_BRANCH_NODE_TYPE,
  WORKFLOW_CANVAS_NODE_TYPE,
  WORKFLOW_CANVAS_SNAP_GRID,
  haveSameNodePositions,
  reorganizeWorkflowDefinition,
  snapWorkflowNodePosition,
  updateNodePosition,
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
  selectedWorkflowNodeIdAtom,
  isWorkflowReadOnlyAtom,
  isWorkflowSnapToCanvasEnabledAtom,
  openWorkflowNodeConfigModalAtom,
  setWorkflowDefinitionAtom,
  toggleWorkflowInspectorAtom,
  workflowAtom,
  workflowCanvasDirectionAtom,
  workflowDefinitionAtom,
  workflowFlowNodesAtom,
} from "@/modules/ee/workflows/state/editor";
import { editorRunDrawerAtom } from "@/modules/ee/workflows/state/run-drawer";
import { Button } from "@/modules/ui/components/button";
import { AddButtonEdge } from "./add-button-edge";
import { BranchEdge } from "./branch-edge";
import { CanvasControls } from "./canvas-controls";
import { hoveredWorkflowEdgeIdAtom } from "./edge-insert-button";
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

// The canvas is the page's main action — let fitView scale small flows past the former 0.85 cap,
// which rendered a fresh two-node workflow noticeably small. 2x proved too big; 1.15 is three
// zoom-out steps down from it (RF's zoomIn/zoomOut step is 1.2x, and 2 / 1.2^3 ≈ 1.157).
const WORKFLOW_CANVAS_MAX_ZOOM = 1.15;

// The inspector column animates its width over 150ms (see workflow-inspector-panel.tsx); refit
// only after the canvas has its final size, with a small buffer.
const INSPECTOR_RESIZE_SETTLE_MS = 170;
// Near-instant pan: the refit should feel like part of the sidebar toggle, not a second animation.
const INSPECTOR_REFIT_PAN_MS = INSPECTOR_RESIZE_SETTLE_MS / 4;
// How close to the canvas edge a step's card may sit before opening it pans it into view.
const REVEAL_MARGIN = 24;

interface WorkflowCanvasProps {
  isEditable: boolean;
}

/** How long a re-arranged flow takes to reach React Flow and be measured, before the view refits. */
const LAYOUT_REFIT_DELAY_MS = 120;

const WorkflowCanvasContent = ({ isEditable }: Readonly<WorkflowCanvasProps>) => {
  const { t } = useTranslation();
  const workflow = useAtomValue(workflowAtom);
  const definition = useAtomValue(workflowDefinitionAtom);
  const flowNodes = useAtomValue(workflowFlowNodesAtom);
  const isSnapToCanvasEnabled = useAtomValue(isWorkflowSnapToCanvasEnabledAtom);
  const isLocked = useAtomValue(isCanvasLockedAtom);
  const setLocked = useSetAtom(isCanvasLockedAtom);
  const direction = useAtomValue(workflowCanvasDirectionAtom);
  const isInspectorCollapsed = useAtomValue(isWorkflowInspectorCollapsedAtom);
  const isNodeConfigOpen = useAtomValue(isWorkflowNodeConfigModalOpenAtom);
  const selectedNodeId = useAtomValue(selectedWorkflowNodeIdAtom);
  const toggleInspector = useSetAtom(toggleWorkflowInspectorAtom);
  const closeNodeConfig = useSetAtom(closeWorkflowNodeConfigModalAtom);
  const setHoveredEdgeId = useSetAtom(hoveredWorkflowEdgeIdAtom);
  useStepClipboardShortcuts();
  const setDefinition = useSetAtom(setWorkflowDefinitionAtom);
  const setFlowNodes = useSetAtom(workflowFlowNodesAtom);
  const openNodeConfigModal = useSetAtom(openWorkflowNodeConfigModalAtom);
  const addTrigger = useSetAtom(addWorkflowTriggerAtom);
  const { fitView, getInternalNode, getViewport, setCenter } = useReactFlow();
  const isRunDrawerOpen = useAtomValue(editorRunDrawerAtom).isOpen;
  const canvasRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    setFlowNodes((currentNodes) => {
      const currentNodesById = new Map(currentNodes.map((node) => [node.id, node]));

      return derivedFlowNodes.map((node) => ({
        ...node,
        selected: openNodeId
          ? node.id === openNodeId
          : (currentNodesById.get(node.id)?.selected ?? node.selected),
      }));
    });
  }, [derivedFlowNodes, openNodeId, setFlowNodes]);

  // Each If/else and Switch puts its fork's legs right above its branches' steps, from where the
  // canvas has them now, so a branch's line runs straight down even while its step is dragged.
  const definitionEdges = definition?.edges;
  const displayedFlowNodes = useMemo(() => {
    const nodes = withBranchLegOffsets(flowNodes, definitionEdges ?? [], direction);
    if (!runHighlight) return nodes;
    return nodes.map((node) =>
      runHighlight.notTakenStepIds.has(node.id)
        ? { ...node, className: cn(node.className, "opacity-40") }
        : node
    );
  }, [flowNodes, definitionEdges, runHighlight, direction]);

  const handleNodesChange: OnNodesChange<Node<TWorkflowNodeData>> = useCallback(
    (changes) => setFlowNodes((currentNodes) => applyNodeChanges(changes, currentNodes)),
    [setFlowNodes]
  );

  const handleNodeDragStop = useCallback(
    (node: Node<TWorkflowNodeData>) => {
      if (!canMutate) return;

      const position = isSnapToCanvasEnabled ? snapWorkflowNodePosition(node.position) : node.position;
      setDefinition((currentDefinition) =>
        currentDefinition ? updateNodePosition(currentDefinition, node.id, position) : currentDefinition
      );
    },
    [canMutate, isSnapToCanvasEnabled, setDefinition]
  );

  // Fit the flow into the part of the canvas that is not behind the Test run drawer, which slides
  // in over the canvas's right side without resizing it. The drawer is measured at call time, so a
  // narrow screen's full-width drawer counts too.
  const refitViewport = useCallback(
    (duration: number) => {
      const canvas = canvasRef.current?.getBoundingClientRect();
      let coverLeft: number | null = null;
      if (isRunDrawerOpen) {
        const drawerWidth =
          document.querySelector<HTMLElement>(TEST_RUN_DRAWER_SELECTOR)?.offsetWidth ?? window.innerWidth;
        coverLeft = window.innerWidth - drawerWidth;
      }
      const padding = canvas
        ? getCanvasFitPadding({ canvasLeft: canvas.left, canvasRight: canvas.right, coverLeft })
        : WORKFLOW_CANVAS_FIT_PADDING;
      // Too little left visible to fit into: keep the current zoom and pan.
      if (padding === null) return;
      void fitView({ padding, maxZoom: WORKFLOW_CANVAS_MAX_ZOOM, minZoom: 0.4, duration });
    },
    [fitView, isRunDrawerOpen]
  );

  // Brings a step into view at the user's zoom: only when part of its card is outside the canvas
  // (behind the panel's edge, or a new step at the bottom), and only by panning.
  const revealNode = useCallback(
    (nodeId: string, duration: number) => {
      const node = getInternalNode(nodeId);
      const canvas = canvasRef.current?.getBoundingClientRect();
      if (!node || !canvas) return;
      const { x, y, zoom } = getViewport();
      const width = node.measured.width ?? 0;
      const height = node.measured.height ?? 0;
      const { x: nodeX, y: nodeY } = node.internals.positionAbsolute;
      const left = nodeX * zoom + x;
      const top = nodeY * zoom + y;
      const isInView =
        left >= REVEAL_MARGIN &&
        top >= REVEAL_MARGIN &&
        left + width * zoom <= canvas.width - REVEAL_MARGIN &&
        top + height * zoom <= canvas.height - REVEAL_MARGIN;
      if (isInView) return;
      void setCenter(nodeX + width / 2, nodeY + height / 2, { zoom, duration });
    },
    [getInternalNode, getViewport, setCenter]
  );

  // Opening a step (a click, a new step) or opening/closing the panel keeps the user's zoom and place
  // (ENG review: every click re-fit the flow). Once the panel's width transition settles, the open
  // step is panned into view if the panel or the canvas edge hides it.
  const isInspectorVisible = isNodeConfigOpen && !isInspectorCollapsed;
  useEffect(() => {
    if (!openNodeId) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeoutHandle = setTimeout(
      () => revealNode(openNodeId, prefersReducedMotion ? 0 : INSPECTOR_REFIT_PAN_MS * 4),
      INSPECTOR_RESIZE_SETTLE_MS
    );
    return () => clearTimeout(timeoutHandle);
  }, [openNodeId, isInspectorVisible, revealNode]);

  // Opening or closing the Test run drawer fits the flow into the part of the canvas it leaves
  // visible, so the run's path can be read whole.
  const previousRunDrawerOpenRef = useRef(isRunDrawerOpen);
  useEffect(() => {
    if (previousRunDrawerOpenRef.current === isRunDrawerOpen) return;
    previousRunDrawerOpenRef.current = isRunDrawerOpen;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeoutHandle = setTimeout(
      () => refitViewport(prefersReducedMotion ? 0 : INSPECTOR_REFIT_PAN_MS),
      INSPECTOR_RESIZE_SETTLE_MS
    );
    return () => clearTimeout(timeoutHandle);
  }, [isRunDrawerOpen, refitViewport]);

  const handleFitView = useCallback(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    refitViewport(prefersReducedMotion ? 0 : 300);
  }, [refitViewport]);

  const recenterAfterLayout = useCallback(() => {
    // Skip the animated recenter for users who ask for reduced motion (read at call time —
    // no reactivity needed for a click handler).
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Wait for the new positions to reach React Flow (definition, then nodes, then their measured
    // sizes) before it recenters the viewport; one frame is too early for a whole new orientation.
    setTimeout(() => refitViewport(prefersReducedMotion ? 0 : 300), LAYOUT_REFIT_DELAY_MS);
  }, [refitViewport]);

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
    if (direction === "horizontal") setTimeout(() => refitViewport(0), LAYOUT_REFIT_DELAY_MS);
  }, [workflow?.id, definition, direction, refitViewport]);

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
      {/* The inspector only ever shows a node's config now, so the collapse toggle is only
          offered while one is open. */}
      {isNodeConfigOpen ? (
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="outline"
            size="icon"
            className="bg-white"
            aria-label={
              isInspectorCollapsed
                ? t("workspace.workflows.expand_inspector")
                : t("workspace.workflows.collapse_inspector")
            }
            aria-pressed={!isInspectorCollapsed}
            onClick={toggleInspector}>
            {isInspectorCollapsed ? <PanelRightOpenIcon /> : <PanelLeftIcon />}
          </Button>
        </div>
      ) : null}
      <ReactFlow
        nodes={displayedFlowNodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={handleNodesChange}
        onNodeDragStop={(_event, node) => handleNodeDragStop(node)}
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
        // Disable the delete key entirely when mutation is gated. RF's deleteKeyCode defaults to
        // "Backspace"; leaving it on lets a read-only member (or an editor on an enabled/archived
        // workflow) visually drop a selected node — applyNodeChanges removes it from local flowNodes
        // without ever touching the definition, so the change never persists and re-syncs on reload
        // into an inconsistent canvas (orphaned edge). `null` disables the shortcut in RF 12.
        deleteKeyCode={canMutate ? "Backspace" : null}
        nodesConnectable={false}
        snapGrid={WORKFLOW_CANVAS_SNAP_GRID}
        snapToGrid={isSnapToCanvasEnabled}
        proOptions={{ hideAttribution: true }}
        elementsSelectable={!isLocked}
        nodesFocusable={!isLocked}>
        {/* Same dot grid the pre-ReactFlow mockup used: radial-gradient(#cbd5e1 1px) on an 18px grid. */}
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.5} color="#cbd5e1" />
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
    </div>
  );
};

export const WorkflowCanvas = (props: Readonly<WorkflowCanvasProps>) => (
  <ReactFlowProvider>
    <WorkflowCanvasContent {...props} />
  </ReactFlowProvider>
);
