"use client";

import {
  Background,
  BackgroundVariant,
  type EdgeTypes,
  type NodeTypes,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Provider as JotaiProvider, createStore } from "jotai";
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import { AddButtonEdge } from "@/modules/ee/workflows/components/canvas/add-button-edge";
import { BranchEdge } from "@/modules/ee/workflows/components/canvas/branch-edge";
import {
  CanvasControlsBar,
  CanvasZoomControls,
} from "@/modules/ee/workflows/components/canvas/canvas-controls";
import { WorkflowBranchNode } from "@/modules/ee/workflows/components/canvas/workflow-branch-node";
import { WorkflowCanvasNode } from "@/modules/ee/workflows/components/canvas/workflow-canvas-node";
import "@/modules/ee/workflows/components/canvas/workflow-canvas.css";
import { getRunDetailBadge } from "@/modules/ee/workflows/components/runs/run-detail-steps";
import { WORKFLOW_CANVAS_MAX_ZOOM } from "@/modules/ee/workflows/hooks/use-canvas-viewport";
import { WORKFLOW_CANVAS_FIT_PADDING } from "@/modules/ee/workflows/lib/canvas-fit";
import { getCanvasDirection } from "@/modules/ee/workflows/lib/canvas-geometry";
import {
  WORKFLOW_ADD_BUTTON_EDGE_TYPE,
  WORKFLOW_BRANCH_EDGE_TYPE,
  WORKFLOW_BRANCH_NODE_TYPE,
  WORKFLOW_CANVAS_NODE_TYPE,
  withBranchLegOffsets,
  workflowDefinitionToFlowEdges,
  workflowDefinitionToFlowNodes,
} from "@/modules/ee/workflows/lib/definition-to-flow";
import { getRunCanvasHighlight, isEdgeOffRunPath } from "@/modules/ee/workflows/lib/run-canvas-highlight";
import type { TRunDetailRow } from "@/modules/ee/workflows/lib/run-detail-rows";
import { type TRunCanvasBadge, getRunCanvasBadges } from "@/modules/ee/workflows/lib/runs-view";
import { type TWorkflowNodeRunBadge, workflowEditorAtom } from "@/modules/ee/workflows/state/editor";
import { canvasRunIdAtom } from "@/modules/ee/workflows/state/test-run";
import type { TWorkflowRunDetail } from "@/modules/ee/workflows/types";

const NODE_TYPES: NodeTypes = {
  [WORKFLOW_CANVAS_NODE_TYPE]: WorkflowCanvasNode,
  [WORKFLOW_BRANCH_NODE_TYPE]: WorkflowBranchNode,
};

const EDGE_TYPES: EdgeTypes = {
  [WORKFLOW_ADD_BUTTON_EDGE_TYPE]: AddButtonEdge,
  [WORKFLOW_BRANCH_EDGE_TYPE]: BranchEdge,
};

interface WorkflowRunCanvasProps {
  /** The graph the run executed (its version, or the draft a Test run saved). */
  definition: TWorkflowDefinition;
  run: TWorkflowRunDetail | null;
  rows: TRunDetailRow[] | null;
  selectedStepId: string | null;
  onSelectStep: (stepId: string | null) => void;
}

const useRunBadgeLabel = () => {
  const { t } = useTranslation();
  return useCallback(
    (badge: TRunCanvasBadge): TWorkflowNodeRunBadge =>
      badge === "not_reached"
        ? { label: t("workspace.workflows.run_step_not_reached"), type: "gray" }
        : getRunDetailBadge(badge, t),
    [t]
  );
};

const RunFlow = ({
  definition,
  run,
  rows,
  selectedStepId,
  onSelectStep,
}: Readonly<WorkflowRunCanvasProps>) => {
  const { t } = useTranslation();
  const { fitView } = useReactFlow();
  const toRunBadge = useRunBadgeLabel();
  const direction = getCanvasDirection(definition);
  const highlight = useMemo(() => getRunCanvasHighlight(run), [run]);
  const badges = useMemo(() => (rows ? getRunCanvasBadges(definition, rows) : null), [definition, rows]);

  const derivedNodes = useMemo(() => {
    const flowNodes = workflowDefinitionToFlowNodes(definition, t, { isDraft: false, direction });
    const edges = workflowDefinitionToFlowEdges(definition);
    return withBranchLegOffsets(flowNodes, edges, direction).map((node) => {
      const badge = badges?.get(node.id);
      const isOffPath = badge === "not_taken" || badge === "not_reached";
      return {
        ...node,
        draggable: false,
        selected: node.id === selectedStepId,
        className: isOffPath ? "opacity-40" : node.className,
        // A run is read, not checked: no setup warnings, no `+` at branch ends.
        data: {
          ...node.data,
          canAppendStep: false,
          issue: null,
          runBadge: badge ? toRunBadge(badge) : undefined,
        },
      };
    });
  }, [definition, t, direction, badges, selectedStepId, toRunBadge]);

  // Kept in React Flow's own state, like the editor's canvas, so each card keeps the size React Flow
  // measured: rebuilt nodes without it read as unmeasured, and fitting would skip them.
  const [nodes, setNodes, onNodesChange] = useNodesState(derivedNodes);
  useEffect(() => {
    setNodes((current) => {
      const measuredById = new Map(current.map((node) => [node.id, node.measured]));
      return derivedNodes.map((node) => ({ ...node, measured: measuredById.get(node.id) }));
    });
  }, [derivedNodes, setNodes]);

  const edges = useMemo(() => {
    const flowEdges = workflowDefinitionToFlowEdges(definition);
    if (!highlight) return flowEdges;
    return flowEdges.map((edge) =>
      isEdgeOffRunPath(edge, highlight) ? { ...edge, style: { ...edge.style, opacity: 0.35 } } : edge
    );
  }, [definition, highlight]);

  // A new run, a run drawn on another graph, or a canvas resized by a side panel collapsing or
  // opening: show all of it, once its cards are measured (fitting before that sizes the view to cards
  // of zero size). A run is read, not edited, so following the canvas's size beats keeping a zoom.
  const runId = run?.id ?? null;
  const areNodesMeasured = useNodesInitialized();
  const paneWidth = useStore((state) => state.width);
  const paneHeight = useStore((state) => state.height);
  useEffect(() => {
    if (!areNodesMeasured) return;
    const handle = setTimeout(() => {
      void fitView({ padding: WORKFLOW_CANVAS_FIT_PADDING, maxZoom: WORKFLOW_CANVAS_MAX_ZOOM, minZoom: 0.4 });
    }, 50);
    return () => clearTimeout(handle);
  }, [areNodesMeasured, runId, definition, paneWidth, paneHeight, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      onNodesChange={onNodesChange}
      onNodeClick={(_event, node) => onSelectStep(node.id)}
      onPaneClick={() => onSelectStep(null)}
      nodesDraggable={false}
      nodesConnectable={false}
      deleteKeyCode={null}
      fitView
      fitViewOptions={{
        padding: WORKFLOW_CANVAS_FIT_PADDING,
        maxZoom: WORKFLOW_CANVAS_MAX_ZOOM,
        minZoom: 0.4,
      }}
      minZoom={0.4}
      maxZoom={WORKFLOW_CANVAS_MAX_ZOOM}
      proOptions={{ hideAttribution: true }}>
      <Background variant={BackgroundVariant.Dots} gap={18} size={1.5} color="#cbd5e1" />
      <CanvasControlsBar>
        <CanvasZoomControls
          onFitView={() =>
            void fitView({
              padding: WORKFLOW_CANVAS_FIT_PADDING,
              maxZoom: WORKFLOW_CANVAS_MAX_ZOOM,
              minZoom: 0.4,
              duration: 300,
            })
          }
        />
      </CanvasControlsBar>
    </ReactFlow>
  );
};

/**
 * A run drawn on the graph it ran (review point 1), read-only: each card says what the run did there,
 * the path it took stays solid and the rest is faded, and clicking a card selects that step. It
 * renders the editor's own cards and edges inside its own Jotai store, read-only, so no editing
 * control (the ⋮ menu, the `+` buttons) can appear and the editor's draft is never touched.
 */
export const WorkflowRunCanvas = (props: Readonly<WorkflowRunCanvasProps>) => {
  const { definition } = props;
  const runId = props.run?.id ?? null;
  // A store per graph and run, filled before the cards first read it: the graph they belong to (its
  // direction), that nothing can be edited, and the run they mark.
  const store = useMemo(() => {
    const runStore = createStore();
    runStore.set(workflowEditorAtom, (state) => ({ ...state, isReadOnly: true, definition }));
    runStore.set(canvasRunIdAtom, runId);
    return runStore;
  }, [definition, runId]);

  return (
    <JotaiProvider store={store}>
      <ReactFlowProvider>
        <RunFlow {...props} />
      </ReactFlowProvider>
    </JotaiProvider>
  );
};
