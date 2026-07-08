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
import { PanelLeftIcon, PanelRightOpenIcon, PlayIcon, SettingsIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TWorkflowTestProblem } from "@formbricks/workflows";
import { cn } from "@/lib/cn";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { useWorkflowEmailAuthoringContext } from "@/modules/workflows/components/workflow-email-authoring-context";
import { testWorkflow } from "@/modules/workflows/lib/api-client";
import { resolveBoundTriggerSurvey } from "@/modules/workflows/lib/bound-survey";
import {
  WORKFLOW_CANVAS_NODE_TYPE,
  WORKFLOW_CANVAS_SNAP_GRID,
  reorganizeWorkflowDefinition,
  snapWorkflowNodePosition,
  updateNodePosition,
  workflowDefinitionToFlowEdges,
  workflowDefinitionToFlowNodes,
} from "@/modules/workflows/lib/definition-to-flow";
import {
  type TWorkflowNodeData,
  isCanvasLockedAtom,
  isWorkflowInspectorCollapsedAtom,
  isWorkflowNodeConfigModalOpenAtom,
  isWorkflowSnapToCanvasEnabledAtom,
  openWorkflowNodeConfigModalAtom,
  openWorkflowSettingsPanelAtom,
  setWorkflowDefinitionAtom,
  setWorkflowFlowNodesAtom,
  toggleWorkflowInspectorAtom,
  workflowAtom,
  workflowDefinitionAtom,
  workflowFlowNodesAtom,
} from "@/modules/workflows/state/editor";
import { WorkflowTestResultDialog } from "../workflow-test-result-dialog";
import { AddButtonEdge } from "./add-button-edge";
import { CanvasControls } from "./canvas-controls";
import { WorkflowCanvasNode } from "./workflow-canvas-node";

const NODE_TYPES: NodeTypes = {
  [WORKFLOW_CANVAS_NODE_TYPE]: WorkflowCanvasNode,
};

const EDGE_TYPES: EdgeTypes = {
  addButton: AddButtonEdge,
};

// The canvas is the page's main action — let fitView scale small flows past the former 0.85 cap,
// which rendered a fresh two-node workflow noticeably small. 2x proved too big; 1.15 is three
// zoom-out steps down from it (RF's zoomIn/zoomOut step is 1.2x, and 2 / 1.2^3 ≈ 1.157).
const WORKFLOW_CANVAS_MAX_ZOOM = 1.15;

interface WorkflowCanvasProps {
  isEditable: boolean;
  /** Workspace write permission. Distinct from `isEditable` (which is also false when enabled). */
  isReadOnly: boolean;
}

const WorkflowCanvasContent = ({ isEditable, isReadOnly }: Readonly<WorkflowCanvasProps>) => {
  const { t } = useTranslation();
  const workflow = useAtomValue(workflowAtom);
  const definition = useAtomValue(workflowDefinitionAtom);
  const flowNodes = useAtomValue(workflowFlowNodesAtom);
  const isSnapToCanvasEnabled = useAtomValue(isWorkflowSnapToCanvasEnabledAtom);
  const isLocked = useAtomValue(isCanvasLockedAtom);
  const setLocked = useSetAtom(isCanvasLockedAtom);
  const isInspectorCollapsed = useAtomValue(isWorkflowInspectorCollapsedAtom);
  const isNodeConfigOpen = useAtomValue(isWorkflowNodeConfigModalOpenAtom);
  const openSettingsPanel = useSetAtom(openWorkflowSettingsPanelAtom);
  const toggleInspector = useSetAtom(toggleWorkflowInspectorAtom);
  // The Settings view is the visible inspector content (as opposed to collapsed or node config).
  const isSettingsOpen = !isInspectorCollapsed && !isNodeConfigOpen;
  const setDefinition = useSetAtom(setWorkflowDefinitionAtom);
  const setFlowNodes = useSetAtom(setWorkflowFlowNodesAtom);
  const openNodeConfigModal = useSetAtom(openWorkflowNodeConfigModalAtom);
  const { fitView } = useReactFlow();
  const isEnabled = workflow?.status === "enabled";
  // Dry-run testing is only meaningful for live workflows (draft is still being built, archived is
  // dead) and requires workspace write access — testWorkflow authorizes with readWrite, so a
  // read-only user would only get a 403. Mirrors the API guard in workflows.handlers.ts.
  const isTestable = !isReadOnly && (workflow?.status === "enabled" || workflow?.status === "disabled");
  const [isTesting, setIsTesting] = useState(false);
  // null = dialog closed; a non-empty array opens the problems dialog (the ok case is a toast).
  const [testProblems, setTestProblems] = useState<TWorkflowTestProblem[] | null>(null);
  // `isEditable` (canEditDefinition) is the API-side gate. The lock toggle is the user-driven
  // gate layered on top: even when permissions allow editing, the canvas stays read-only until
  // the user unlocks it.
  const canMutate = isEditable && !isLocked;

  const authoringContext = useWorkflowEmailAuthoringContext();
  const hasBoundSurvey = Boolean(resolveBoundTriggerSurvey(authoringContext, definition));

  const derivedFlowNodes = useMemo(
    () => (definition ? workflowDefinitionToFlowNodes(definition, t, { hasBoundSurvey }) : []),
    [definition, t, hasBoundSurvey]
  );
  const flowEdges = useMemo(
    () => (definition ? workflowDefinitionToFlowEdges(definition) : []),
    [definition]
  );

  // Keep ReactFlow's nodes in sync with the projected definition while preserving the user's
  // current selection — recomputing from scratch would lose it on every definition edit.
  useEffect(() => {
    setFlowNodes((currentNodes) => {
      const currentNodesById = new Map(currentNodes.map((node) => [node.id, node]));

      return derivedFlowNodes.map((node) => ({
        ...node,
        selected: currentNodesById.get(node.id)?.selected ?? node.selected,
      }));
    });
  }, [derivedFlowNodes, setFlowNodes]);

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

  const handleAutoLayout = useCallback(() => {
    if (!canMutate) return;
    setDefinition((currentDefinition) =>
      currentDefinition ? reorganizeWorkflowDefinition(currentDefinition) : currentDefinition
    );
    // Defer one frame so the new node positions render before RF recenters the viewport.
    requestAnimationFrame(() =>
      fitView({ padding: 0.25, maxZoom: WORKFLOW_CANVAS_MAX_ZOOM, minZoom: 0.4, duration: 300 })
    );
  }, [canMutate, setDefinition, fitView]);

  const handleRunWorkflow = async () => {
    // Dry-run the workflow: validate its survey + ending references without running it or causing
    // side effects. Valid → toast; problems → dialog listing them. The button is disabled unless
    // the workflow is testable (enabled/disabled), so `workflow` is always present here.
    if (!workflow || isTesting) return;
    setIsTesting(true);
    try {
      const result = await testWorkflow(workflow.id);
      if (result.ok) {
        toast.success(t("workspace.workflows.test_success"));
      } else {
        setTestProblems(result.problems);
      }
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.test_failed")));
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleLock = () => {
    if (!isLocked) {
      setLocked(true);
      return;
    }
    if (isEnabled) {
      toast.error(t("workspace.workflows.edit_blocked_active"));
      return;
    }
    if (!isEditable) return;
    setLocked(false);
  };

  return (
    <div
      className={cn(
        "relative flex-1 self-stretch overflow-hidden rounded-lg border border-slate-200 bg-white"
      )}>
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <Button
          variant="secondary"
          onClick={handleRunWorkflow}
          loading={isTesting}
          disabled={!isTestable || isTesting}>
          {t("workspace.workflows.test")}
          <PlayIcon className="size-4" />
        </Button>
        {/* Cog jumps to the workflow Settings view; the panel button only collapses/expands. */}
        <Button
          variant="outline"
          size="icon"
          className="bg-white"
          aria-label={t("workspace.workflows.settings_title")}
          disabled={isSettingsOpen}
          onClick={openSettingsPanel}>
          <SettingsIcon />
        </Button>
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
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={handleNodesChange}
        onNodeDragStop={(_event, node) => handleNodeDragStop(node)}
        onNodeClick={(_event, node) => openNodeConfigModal(node.id)}
        className="bg-slate-50"
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: WORKFLOW_CANVAS_MAX_ZOOM, minZoom: 0.4 }}
        defaultViewport={{ x: 0, y: 0, zoom: WORKFLOW_CANVAS_MAX_ZOOM }}
        nodesDraggable={canMutate}
        nodesConnectable={false}
        snapGrid={WORKFLOW_CANVAS_SNAP_GRID}
        snapToGrid={isSnapToCanvasEnabled}
        proOptions={{ hideAttribution: true }}
        elementsSelectable>
        {/* Same dot grid the pre-ReactFlow mockup used: radial-gradient(#cbd5e1 1px) on an 18px grid. */}
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.5} color="#cbd5e1" />
      </ReactFlow>
      <CanvasControls
        canEdit={isEditable}
        canMutate={canMutate}
        isLocked={isLocked}
        onAutoLayout={handleAutoLayout}
        onToggleLock={handleToggleLock}
      />
      <WorkflowTestResultDialog
        open={testProblems !== null}
        onOpenChange={(open) => {
          if (!open) setTestProblems(null);
        }}
        problems={testProblems ?? []}
      />
    </div>
  );
};

export const WorkflowCanvas = (props: Readonly<WorkflowCanvasProps>) => (
  <ReactFlowProvider>
    <WorkflowCanvasContent {...props} />
  </ReactFlowProvider>
);
