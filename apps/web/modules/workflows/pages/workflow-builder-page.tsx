"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  type Node,
  type NodeProps,
  type OnNodesChange,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type SnapGrid,
  applyNodeChanges,
} from "@xyflow/react";
import { Provider, useAtomValue, useSetAtom } from "jotai";
import {
  GitBranchIcon,
  MailIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  PowerIcon,
  PowerOffIcon,
  RefreshCcwIcon,
  WebhookIcon,
  ZapIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TWorkflowDefinition, TWorkflowNode } from "@formbricks/types/workflows";
import { ZWorkflowDefinition } from "@formbricks/types/workflows";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { Switch } from "@/modules/ui/components/switch";
import { WorkflowStatusPill } from "../components/status-badges";
import { WorkflowSecondaryNavigation } from "../components/workflow-secondary-navigation";
import { disableWorkflow, enableWorkflow, getWorkflow, updateWorkflow } from "../lib/api-client";
import { WorkflowBuilderLoading } from "../loading";
import {
  type TWorkflowNodeData,
  hydrateWorkflowEditorAtom,
  isWorkflowConfigDrawerCollapsedAtom,
  isWorkflowSnapToCanvasEnabledAtom,
  selectedWorkflowNodeIdAtom,
  setSelectedWorkflowNodeIdAtom,
  setWorkflowAtom,
  setWorkflowDefinitionAtom,
  setWorkflowDescriptionAtom,
  setWorkflowFlowNodesAtom,
  setWorkflowNameAtom,
  setWorkflowSnapToCanvasEnabledAtom,
  toggleWorkflowConfigDrawerAtom,
  workflowAtom,
  workflowDefinitionAtom,
  workflowDescriptionAtom,
  workflowFlowNodesAtom,
  workflowNameAtom,
} from "../state/editor";

type TTranslate = (key: string, options?: Record<string, unknown>) => string;

type TWorkflowBuilderPageProps = Readonly<{ workspaceId: string; workflowId: string; isReadOnly: boolean }>;

const nodeChipClassNames = {
  trigger: "bg-brand-dark text-white",
  flow: "bg-green-700 text-white",
  action: "bg-red-700 text-white",
};

const nodeIcons = {
  trigger: ZapIcon,
  ifElse: GitBranchIcon,
  email: MailIcon,
  webhook: WebhookIcon,
};

const WorkflowCanvasNode = memo(({ data, selected }: NodeProps<Node<TWorkflowNodeData>>) => {
  const Icon = nodeIcons[data.icon];

  return (
    <div
      className={[
        "w-72 rounded-lg border border-slate-200 bg-white shadow-card-sm transition-shadow hover:shadow-card-md",
        selected ? "ring-2 ring-brand-dark ring-offset-2 ring-offset-slate-50" : "",
      ].join(" ")}>
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2 !border-2 !border-slate-300 !bg-white"
      />
      <div className="flex h-9 items-center gap-2 border-b border-slate-200 px-3">
        <span
          className={`flex size-6 items-center justify-center rounded-md ${nodeChipClassNames[data.category]}`}>
          <Icon className="size-4" strokeWidth={1.5} />
        </span>
        <span className="truncate text-sm font-semibold text-slate-800">{data.title}</span>
      </div>
      <div className="line-clamp-3 p-3 text-sm text-slate-600">{data.summary}</div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-2 !border-2 !border-slate-300 !bg-white"
      />
    </div>
  );
});

WorkflowCanvasNode.displayName = "WorkflowCanvasNode";

const nodeTypes = {
  workflow: WorkflowCanvasNode,
};

const workflowCanvasSnapGrid: SnapGrid = [20, 20];
const workflowCanvasNodeSpacing = {
  x: 360,
  y: 180,
};
const workflowCanvasStartPosition = {
  x: 220,
  y: 80,
};

const getNodeTitle = (node: TWorkflowDefinition["trigger"] | TWorkflowNode, t: TTranslate): string => {
  if (node.type === "trigger") {
    return t("workspace.workflows.response_completed");
  }

  if (node.type === "ifElse") {
    return t("workspace.workflows.if_else");
  }

  return node.actionType === "sendEmailPreview"
    ? t("workspace.workflows.send_email_preview")
    : t("workspace.workflows.send_webhook_preview");
};

const getNodeSummary = (node: TWorkflowDefinition["trigger"] | TWorkflowNode, t: TTranslate): string => {
  if (node.type === "trigger") {
    return node.config.surveyId
      ? t("workspace.workflows.survey_trigger_summary", { surveyId: node.config.surveyId })
      : t("workspace.workflows.any_completed_response");
  }

  if (node.type === "ifElse") {
    return t("workspace.workflows.if_else_summary");
  }

  if (node.actionType === "sendEmailPreview") {
    return t("workspace.workflows.email_preview_summary", { to: node.config.to });
  }

  return t("workspace.workflows.webhook_preview_summary", { url: node.config.url });
};

const workflowDefinitionToFlowNodes = (
  definition: TWorkflowDefinition,
  t: TTranslate
): Array<Node<TWorkflowNodeData>> => {
  const allNodes = [definition.trigger, ...definition.nodes];

  return allNodes.map((node, index) => {
    const isTrigger = node.type === "trigger";
    const position = node.ui?.position ?? { x: 120, y: 80 + index * 160 };
    const category = isTrigger ? "trigger" : node.type === "ifElse" ? "flow" : "action";
    const icon = isTrigger
      ? "trigger"
      : node.type === "ifElse"
        ? "ifElse"
        : node.actionType === "sendEmailPreview"
          ? "email"
          : "webhook";

    return {
      id: node.id,
      type: "workflow",
      position,
      data: {
        category,
        title: getNodeTitle(node, t),
        summary: getNodeSummary(node, t),
        icon,
      },
    };
  });
};

const workflowDefinitionToFlowEdges = (definition: TWorkflowDefinition) =>
  definition.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.branch === "next" ? undefined : edge.branch,
    type: "smoothstep",
    animated: edge.branch === "then",
  }));

const updateNodePosition = (
  definition: TWorkflowDefinition,
  nodeId: string,
  position: { x: number; y: number }
): TWorkflowDefinition => {
  if (definition.trigger.id === nodeId) {
    return {
      ...definition,
      trigger: {
        ...definition.trigger,
        ui: {
          ...definition.trigger.ui,
          position,
        },
      },
    };
  }

  return {
    ...definition,
    nodes: definition.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            ui: {
              ...node.ui,
              position,
            },
          }
        : node
    ),
  };
};

const snapWorkflowNodePosition = (position: { x: number; y: number }) => ({
  x: Math.round(position.x / workflowCanvasSnapGrid[0]) * workflowCanvasSnapGrid[0],
  y: Math.round(position.y / workflowCanvasSnapGrid[1]) * workflowCanvasSnapGrid[1],
});

const reorganizeWorkflowDefinition = (definition: TWorkflowDefinition): TWorkflowDefinition => {
  const nodesById = new Map([definition.trigger, ...definition.nodes].map((node) => [node.id, node]));
  const originalNodeOrder = [definition.trigger.id, ...definition.nodes.map((node) => node.id)];
  const edgesBySource = new Map<string, string[]>();

  for (const edge of definition.edges) {
    edgesBySource.set(edge.source, [...(edgesBySource.get(edge.source) ?? []), edge.target]);
  }

  const ranks = new Map<string, number>([[definition.trigger.id, 0]]);
  const queue = [definition.trigger.id];

  for (const nodeId of queue) {
    const nextRank = (ranks.get(nodeId) ?? 0) + 1;
    for (const targetId of edgesBySource.get(nodeId) ?? []) {
      if (!nodesById.has(targetId) || ranks.has(targetId)) continue;
      ranks.set(targetId, nextRank);
      queue.push(targetId);
    }
  }

  for (const nodeId of originalNodeOrder) {
    if (!ranks.has(nodeId)) {
      ranks.set(nodeId, ranks.size);
    }
  }

  const nodeIdsByRank = new Map<number, string[]>();
  for (const nodeId of originalNodeOrder) {
    const rank = ranks.get(nodeId) ?? 0;
    nodeIdsByRank.set(rank, [...(nodeIdsByRank.get(rank) ?? []), nodeId]);
  }

  const positionsByNodeId = new Map<string, { x: number; y: number }>();
  for (const [rank, nodeIds] of nodeIdsByRank) {
    const rowOffset = ((nodeIds.length - 1) * workflowCanvasNodeSpacing.x) / 2;
    nodeIds.forEach((nodeId, index) => {
      positionsByNodeId.set(
        nodeId,
        snapWorkflowNodePosition({
          x: workflowCanvasStartPosition.x + index * workflowCanvasNodeSpacing.x - rowOffset,
          y: workflowCanvasStartPosition.y + rank * workflowCanvasNodeSpacing.y,
        })
      );
    });
  }

  return {
    ...definition,
    trigger: {
      ...definition.trigger,
      ui: {
        ...definition.trigger.ui,
        position: positionsByNodeId.get(definition.trigger.id) ?? definition.trigger.ui?.position,
      },
    },
    nodes: definition.nodes.map((node) => ({
      ...node,
      ui: {
        ...node.ui,
        position: positionsByNodeId.get(node.id) ?? node.ui?.position,
      },
    })),
  };
};

const NodeConfigDrawer = ({
  definition,
  isEditable,
  isCollapsed,
  selectedNodeId,
  onChange,
  onToggleCollapsed,
}: Readonly<{
  definition: TWorkflowDefinition;
  isEditable: boolean;
  isCollapsed: boolean;
  selectedNodeId: string | null;
  onChange: (definition: TWorkflowDefinition) => void;
  onToggleCollapsed: () => void;
}>) => {
  const { t } = useTranslation();
  const selectedNode =
    selectedNodeId === definition.trigger.id
      ? definition.trigger
      : definition.nodes.find((node) => node.id === selectedNodeId);

  if (isCollapsed) {
    return (
      <aside className="absolute bottom-4 right-4 top-4 flex w-14 justify-center rounded-lg border border-slate-200 bg-white p-2 shadow-card-md">
        <Button
          aria-label={t("workspace.workflows.expand_node_config")}
          size="icon"
          title={t("workspace.workflows.expand_node_config")}
          type="button"
          variant="ghost"
          onClick={onToggleCollapsed}>
          <PanelRightOpenIcon />
        </Button>
      </aside>
    );
  }

  if (!selectedNode) {
    return (
      <aside className="absolute bottom-4 right-4 top-4 w-96 rounded-lg border border-slate-200 bg-white p-4 shadow-card-md">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-800">{t("workspace.workflows.node_config")}</h2>
          <Button
            aria-label={t("workspace.workflows.collapse_node_config")}
            size="icon"
            title={t("workspace.workflows.collapse_node_config")}
            type="button"
            variant="ghost"
            onClick={onToggleCollapsed}>
            <PanelRightCloseIcon />
          </Button>
        </div>
        <p className="mt-2 text-sm text-slate-500">{t("workspace.workflows.select_node")}</p>
      </aside>
    );
  }

  const updateNode = (node: typeof selectedNode) => {
    if (node.type === "trigger") {
      onChange({ ...definition, trigger: node });
      return;
    }

    onChange({
      ...definition,
      nodes: definition.nodes.map((existingNode) => (existingNode.id === node.id ? node : existingNode)),
    });
  };
  const firstIfElseCondition =
    selectedNode.type === "ifElse" ? selectedNode.config.condition.conditions[0] : undefined;
  const selectedCondition =
    firstIfElseCondition && !("connector" in firstIfElseCondition) ? firstIfElseCondition : null;

  return (
    <aside className="absolute bottom-4 right-4 top-4 w-96 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-card-md">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-800">{getNodeTitle(selectedNode, t)}</h2>
          <p className="mt-1 truncate text-xs text-slate-500">{selectedNode.id}</p>
        </div>
        <Button
          aria-label={t("workspace.workflows.collapse_node_config")}
          size="icon"
          title={t("workspace.workflows.collapse_node_config")}
          type="button"
          variant="ghost"
          onClick={onToggleCollapsed}>
          <PanelRightCloseIcon />
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        {selectedNode.type === "trigger" ? (
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t("common.survey_id")}</span>
            <Input
              value={selectedNode.config.surveyId ?? ""}
              disabled={!isEditable}
              placeholder={t("workspace.workflows.any_survey")}
              onChange={(event) =>
                updateNode({
                  ...selectedNode,
                  config: {
                    ...selectedNode.config,
                    surveyId: event.target.value.trim() || null,
                  },
                })
              }
            />
          </label>
        ) : null}

        {selectedNode.type === "ifElse" ? (
          <>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                {t("workspace.workflows.condition_left_path")}
              </span>
              <Input
                value={selectedCondition?.left.path ?? ""}
                disabled={!isEditable}
                onChange={(event) => {
                  if (!selectedCondition) return;
                  updateNode({
                    ...selectedNode,
                    config: {
                      condition: {
                        ...selectedNode.config.condition,
                        conditions: [
                          {
                            ...selectedCondition,
                            left: { type: "ref", path: event.target.value },
                          },
                        ],
                      },
                    },
                  });
                }}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                {t("workspace.workflows.condition_right_value")}
              </span>
              <Input
                value={String(selectedCondition?.right ?? "")}
                disabled={!isEditable}
                onChange={(event) => {
                  if (!selectedCondition) return;
                  updateNode({
                    ...selectedNode,
                    config: {
                      condition: {
                        ...selectedNode.config.condition,
                        conditions: [
                          {
                            ...selectedCondition,
                            right:
                              event.target.value === "true"
                                ? true
                                : event.target.value === "false"
                                  ? false
                                  : event.target.value,
                          },
                        ],
                      },
                    },
                  });
                }}
              />
            </label>
          </>
        ) : null}

        {selectedNode.type === "action" && selectedNode.actionType === "sendEmailPreview" ? (
          <>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{t("workspace.workflows.email_to")}</span>
              <Input
                value={selectedNode.config.to}
                disabled={!isEditable}
                onChange={(event) =>
                  updateNode({
                    ...selectedNode,
                    config: { ...selectedNode.config, to: event.target.value },
                  })
                }
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                {t("workspace.workflows.email_subject")}
              </span>
              <Input
                value={selectedNode.config.subject}
                disabled={!isEditable}
                onChange={(event) =>
                  updateNode({
                    ...selectedNode,
                    config: { ...selectedNode.config, subject: event.target.value },
                  })
                }
              />
            </label>
          </>
        ) : null}

        {selectedNode.type === "action" && selectedNode.actionType === "sendWebhookPreview" ? (
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t("workspace.workflows.webhook_url")}</span>
            <Input
              value={selectedNode.config.url}
              disabled={!isEditable}
              onChange={(event) =>
                updateNode({
                  ...selectedNode,
                  config: { ...selectedNode.config, url: event.target.value },
                })
              }
            />
            <p className="mt-2 text-xs text-slate-500">{t("workspace.workflows.webhook_preview_note")}</p>
          </label>
        ) : null}
      </div>
    </aside>
  );
};

const WorkflowBuilderPageContent = ({ workspaceId, workflowId, isReadOnly }: TWorkflowBuilderPageProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const workflow = useAtomValue(workflowAtom);
  const workflowName = useAtomValue(workflowNameAtom);
  const workflowDescription = useAtomValue(workflowDescriptionAtom);
  const definition = useAtomValue(workflowDefinitionAtom);
  const flowNodes = useAtomValue(workflowFlowNodesAtom);
  const selectedNodeId = useAtomValue(selectedWorkflowNodeIdAtom);
  const isConfigDrawerCollapsed = useAtomValue(isWorkflowConfigDrawerCollapsedAtom);
  const isSnapToCanvasEnabled = useAtomValue(isWorkflowSnapToCanvasEnabledAtom);
  const hydrateWorkflowEditor = useSetAtom(hydrateWorkflowEditorAtom);
  const setWorkflow = useSetAtom(setWorkflowAtom);
  const setWorkflowName = useSetAtom(setWorkflowNameAtom);
  const setWorkflowDescription = useSetAtom(setWorkflowDescriptionAtom);
  const setDefinition = useSetAtom(setWorkflowDefinitionAtom);
  const setFlowNodes = useSetAtom(setWorkflowFlowNodesAtom);
  const setSelectedNodeId = useSetAtom(setSelectedWorkflowNodeIdAtom);
  const setSnapToCanvasEnabled = useSetAtom(setWorkflowSnapToCanvasEnabledAtom);
  const toggleConfigDrawer = useSetAtom(toggleWorkflowConfigDrawerAtom);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const canEdit = Boolean(workflow && !isReadOnly && workflow.status !== "enabled");

  useEffect(() => {
    const loadWorkflow = async () => {
      setIsLoading(true);
      try {
        const loadedWorkflow = await getWorkflow(workflowId);
        hydrateWorkflowEditor({
          workflow: loadedWorkflow,
          flowNodes: workflowDefinitionToFlowNodes(loadedWorkflow.definition, t),
        });
      } catch (error) {
        toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.load_failed")));
      } finally {
        setIsLoading(false);
      }
    };

    void loadWorkflow();
  }, [hydrateWorkflowEditor, workflowId, t]);

  const derivedFlowNodes = useMemo(
    () => (definition ? workflowDefinitionToFlowNodes(definition, t) : []),
    [definition, t]
  );
  const flowEdges = useMemo(
    () => (definition ? workflowDefinitionToFlowEdges(definition) : []),
    [definition]
  );

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
    (changes) => {
      setFlowNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
    },
    [setFlowNodes]
  );

  const handleNodeDragStop = useCallback(
    (node: Node<TWorkflowNodeData>) => {
      if (!canEdit) return;

      const position = isSnapToCanvasEnabled ? snapWorkflowNodePosition(node.position) : node.position;
      setDefinition((currentDefinition) =>
        currentDefinition ? updateNodePosition(currentDefinition, node.id, position) : currentDefinition
      );
    },
    [canEdit, isSnapToCanvasEnabled, setDefinition]
  );

  const handleReorganizeCanvas = () => {
    if (!canEdit) return;
    setDefinition((currentDefinition) =>
      currentDefinition ? reorganizeWorkflowDefinition(currentDefinition) : currentDefinition
    );
  };

  const handleSave = async () => {
    if (!workflow || !definition) return;

    const trimmedWorkflowName = workflowName.trim();
    if (!trimmedWorkflowName) {
      toast.error(t("common.something_went_wrong"));
      return;
    }

    const parsedDefinition = ZWorkflowDefinition.safeParse(definition);
    if (!parsedDefinition.success) {
      toast.error(parsedDefinition.error.issues[0]?.message ?? t("workspace.workflows.validation_failed"));
      return;
    }

    setIsSaving(true);
    try {
      const savedWorkflow = await updateWorkflow({
        workflowId: workflow.id,
        name: trimmedWorkflowName,
        description: workflowDescription.trim() || null,
        definition: parsedDefinition.data,
      });
      setWorkflow(savedWorkflow);
      setWorkflowName(savedWorkflow.name);
      setWorkflowDescription(savedWorkflow.description ?? "");
      setDefinition(savedWorkflow.definition);
      toast.success(t("workspace.workflows.saved"));
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.save_failed")));
    } finally {
      setIsSaving(false);
    }
  };

  const handleLifecycleTransition = async () => {
    if (!workflow) return;

    setIsTransitioning(true);
    try {
      const transitionedWorkflow =
        workflow.status === "enabled"
          ? await disableWorkflow(workflow.id)
          : await enableWorkflow(workflow.id);
      setWorkflow(transitionedWorkflow);
      setWorkflowName(transitionedWorkflow.name);
      setWorkflowDescription(transitionedWorkflow.description ?? "");
      setDefinition(transitionedWorkflow.definition);
      toast.success(
        transitionedWorkflow.status === "enabled"
          ? t("workspace.workflows.enabled")
          : t("workspace.workflows.disabled")
      );
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.lifecycle_failed")));
    } finally {
      setIsTransitioning(false);
    }
  };

  if (isLoading || !workflow || !definition) {
    return <WorkflowBuilderLoading />;
  }

  return (
    <PageContentWrapper className="space-y-4">
      <PageHeader
        pageTitle={workflow.name}
        cta={
          <div className="flex items-center gap-2">
            <WorkflowStatusPill status={workflow.status} />
            {canEdit ? (
              <Button size="sm" variant="secondary" onClick={handleSave} loading={isSaving}>
                {t("common.save")}
              </Button>
            ) : null}
            {!isReadOnly ? (
              <Button size="sm" onClick={handleLifecycleTransition} loading={isTransitioning}>
                {workflow.status === "enabled"
                  ? t("workspace.workflows.disable")
                  : t("workspace.workflows.enable")}
                {workflow.status === "enabled" ? <PowerOffIcon /> : <PowerIcon />}
              </Button>
            ) : null}
          </div>
        }>
        <WorkflowSecondaryNavigation workspaceId={workspaceId} workflowId={workflow.id} activeId="builder" />
      </PageHeader>

      {canEdit ? (
        <div className="grid max-w-3xl gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              {t("workspace.workflows.workflow_name")}
            </span>
            <Input value={workflowName} onChange={(event) => setWorkflowName(event.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              {t("workspace.workflows.workflow_description_optional")}
            </span>
            <Input
              value={workflowDescription}
              placeholder={t("workspace.workflows.workflow_description_placeholder")}
              onChange={(event) => setWorkflowDescription(event.target.value)}
            />
          </label>
        </div>
      ) : workflow.description ? (
        <p className="max-w-3xl text-sm text-slate-500">{workflow.description}</p>
      ) : null}

      <div className="relative h-[680px] overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 p-2 shadow-card-sm">
          <label className="flex items-center gap-2 whitespace-nowrap px-2 text-sm font-medium text-slate-700">
            <Switch
              checked={isSnapToCanvasEnabled}
              disabled={!canEdit}
              onCheckedChange={setSnapToCanvasEnabled}
            />
            {t("workspace.workflows.snap_to_canvas")}
          </label>
          <Button size="sm" variant="secondary" disabled={!canEdit} onClick={handleReorganizeCanvas}>
            {t("workspace.workflows.reorganize")}
            <RefreshCcwIcon />
          </Button>
        </div>
        <ReactFlowProvider>
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onNodeDragStop={(_event, node) => handleNodeDragStop(node)}
            onNodeClick={(_event, node) => setSelectedNodeId(node.id)}
            className="bg-slate-50"
            fitView
            nodesDraggable={canEdit}
            nodesConnectable={false}
            snapGrid={workflowCanvasSnapGrid}
            snapToGrid={isSnapToCanvasEnabled}
            elementsSelectable>
            <Background color="#94a3b8" gap={20} size={1.4} variant={BackgroundVariant.Dots} />
            <Controls />
          </ReactFlow>
        </ReactFlowProvider>

        <NodeConfigDrawer
          definition={definition}
          isEditable={canEdit}
          isCollapsed={isConfigDrawerCollapsed}
          selectedNodeId={selectedNodeId}
          onChange={(updatedDefinition) => {
            if (canEdit) {
              setDefinition(updatedDefinition);
            }
          }}
          onToggleCollapsed={toggleConfigDrawer}
        />
      </div>

      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push(`/workspaces/${workspaceId}/workflows`)}>
          {t("workspace.workflows.back_to_workflows")}
        </Button>
      </div>
    </PageContentWrapper>
  );
};

export const WorkflowBuilderPage = (props: TWorkflowBuilderPageProps) => (
  <Provider>
    <WorkflowBuilderPageContent {...props} />
  </Provider>
);
