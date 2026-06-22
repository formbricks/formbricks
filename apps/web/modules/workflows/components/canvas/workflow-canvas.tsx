"use client";

import {
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
import { PanelLeftIcon, PanelRightOpenIcon, PlayIcon } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
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
  isWorkflowSnapToCanvasEnabledAtom,
  openWorkflowNodeConfigModalAtom,
  setWorkflowDefinitionAtom,
  setWorkflowFlowNodesAtom,
  toggleWorkflowInspectorAtom,
  workflowAtom,
  workflowDefinitionAtom,
  workflowFlowNodesAtom,
} from "@/modules/workflows/state/editor";
import { AddButtonEdge } from "./add-button-edge";
import { CanvasControls } from "./canvas-controls";
import { WorkflowCanvasNode } from "./workflow-canvas-node";

const NODE_TYPES: NodeTypes = {
  [WORKFLOW_CANVAS_NODE_TYPE]: WorkflowCanvasNode,
};

const EDGE_TYPES: EdgeTypes = {
  addButton: AddButtonEdge,
};

interface WorkflowCanvasProps {
  isEditable: boolean;
}

const WorkflowCanvasContent = ({ isEditable }: Readonly<WorkflowCanvasProps>) => {
  const { t } = useTranslation();
  const workflow = useAtomValue(workflowAtom);
  const definition = useAtomValue(workflowDefinitionAtom);
  const flowNodes = useAtomValue(workflowFlowNodesAtom);
  const isSnapToCanvasEnabled = useAtomValue(isWorkflowSnapToCanvasEnabledAtom);
  const isLocked = useAtomValue(isCanvasLockedAtom);
  const setLocked = useSetAtom(isCanvasLockedAtom);
  const isInspectorCollapsed = useAtomValue(isWorkflowInspectorCollapsedAtom);
  const toggleInspector = useSetAtom(toggleWorkflowInspectorAtom);
  const setDefinition = useSetAtom(setWorkflowDefinitionAtom);
  const setFlowNodes = useSetAtom(setWorkflowFlowNodesAtom);
  const openNodeConfigModal = useSetAtom(openWorkflowNodeConfigModalAtom);
  const { fitView } = useReactFlow();
  const isEnabled = workflow?.status === "enabled";
  // `isEditable` (canEditDefinition) is the API-side gate. The lock toggle is the user-driven
  // gate layered on top: even when permissions allow editing, the canvas stays read-only until
  // the user unlocks it.
  const canMutate = isEditable && !isLocked;

  const derivedFlowNodes = useMemo(
    () => (definition ? workflowDefinitionToFlowNodes(definition, t) : []),
    [definition, t]
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
    requestAnimationFrame(() => fitView({ padding: 0.25, maxZoom: 0.85, minZoom: 0.4, duration: 300 }));
  }, [canMutate, setDefinition, fitView]);

  const handleRunWorkflow = () => {
    // Run/test dispatch lands with the test endpoint client wiring (separate ticket); the
    // button is rendered here so the canvas matches the Figma layout end-to-end.
    toast(t("workspace.workflows.test_not_implemented"));
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
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <Button variant="secondary" onClick={handleRunWorkflow}>
          <PlayIcon className="size-4" />
          {t("workspace.workflows.run")}
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
        className="bg-white"
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 0.85, minZoom: 0.4 }}
        defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
        nodesDraggable={canMutate}
        nodesConnectable={false}
        snapGrid={WORKFLOW_CANVAS_SNAP_GRID}
        snapToGrid={isSnapToCanvasEnabled}
        proOptions={{ hideAttribution: true }}
        elementsSelectable
      />
      <CanvasControls
        canEdit={isEditable}
        canMutate={canMutate}
        isLocked={isLocked}
        onAutoLayout={handleAutoLayout}
        onToggleLock={handleToggleLock}
      />
    </div>
  );
};

export const WorkflowCanvas = (props: Readonly<WorkflowCanvasProps>) => (
  <ReactFlowProvider>
    <WorkflowCanvasContent {...props} />
  </ReactFlowProvider>
);
