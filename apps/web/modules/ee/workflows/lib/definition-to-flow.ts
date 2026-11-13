import { type Edge, type Node, type SnapGrid } from "@xyflow/react";
import type { TFunction } from "i18next";
import {
  type TWorkflowDefinition,
  type TWorkflowIfElseBranch,
  type TWorkflowNode,
  getBlankSendEmailContentFields,
  getWorkflowNodeConcreteType,
  isResponseCompletedTrigger,
} from "@formbricks/workflows";
import {
  WORKFLOW_CANVAS_BRANCH_ROW_HEIGHT,
  WORKFLOW_CANVAS_NODE_SPACING,
  WORKFLOW_CANVAS_START_POSITION,
} from "@/modules/ee/workflows/lib/canvas-geometry";
import { getNodeRegistryEntry } from "@/modules/ee/workflows/lib/node-registry";
import type { TWorkflowNodeData, TWorkflowNodeIssue } from "@/modules/ee/workflows/state/editor";

export const WORKFLOW_CANVAS_NODE_TYPE = "workflowCanvasNode";
export const WORKFLOW_BRANCH_NODE_TYPE = "workflowBranchNode";
export const WORKFLOW_ADD_BUTTON_EDGE_TYPE = "addButton";
export const WORKFLOW_BRANCH_EDGE_TYPE = "branch";

export const WORKFLOW_CANVAS_SNAP_GRID: SnapGrid = [20, 20];

const IF_ELSE_BRANCHES: TWorkflowIfElseBranch[] = ["then", "else"];

interface WorkflowFlowNodeOptions {
  /**
   * Whether the trigger's `surveyId` resolves to a real survey (see `resolveBoundTriggerSurvey`).
   * Only the canvas can know this (it needs the server-resolved authoring context), so callers
   * without it — e.g. the initial hydrate — default to true and get corrected on the next render.
   */
  hasBoundSurvey?: boolean;
  /**
   * Drafts get "setup" severity (amber, guiding) — an unfinished config is the normal starting
   * state, not an error. Live or previously-live workflows get "error" (red).
   */
  isDraft?: boolean;
  /**
   * The trigger card's summary when only the canvas can say it, e.g. a Webhook trigger's "Sample
   * received · 9 Variables", which needs the sample from the server.
   */
  triggerSummary?: string;
}

// Client-side counterpart of the dry-run test's checks: flags nodes that can't run as configured.
// Sequential guidance: while the survey is missing only the trigger carries a flag — the email
// step can't be configured until a survey exists, so flagging it too is just noise.
const getWorkflowNodeIssue = (
  node: TWorkflowNode,
  t: TFunction,
  options: Required<Omit<WorkflowFlowNodeOptions, "triggerSummary">>,
  isSurveyTrigger: boolean
): TWorkflowNodeIssue | null => {
  const severity = options.isDraft ? "setup" : "error";
  // Only a Response completed trigger waits for a survey; a Webhook workflow never does.
  const isWaitingForSurvey = isSurveyTrigger && !options.hasBoundSurvey;

  if (node.type === "trigger" && isWaitingForSurvey) {
    return { severity, label: t("workspace.workflows.node_needs_survey") };
  }
  if (node.type === "action" && node.actionType === "send_email" && !isWaitingForSurvey) {
    // Same completeness rule ZWorkflowExecutableDefinition enforces server-side on enable/test,
    // including its rich-text handling of the body (see isBlankWorkflowRichText).
    if (getBlankSendEmailContentFields(node.config).length > 0) {
      return { severity, label: t("workspace.workflows.node_needs_email_content") };
    }
  }
  return null;
};

const getIfElseNodeIds = (definition: TWorkflowDefinition) =>
  new Set(definition.nodes.filter((node) => node.type === "if_else").map((node) => node.id));

export const workflowDefinitionToFlowNodes = (
  definition: TWorkflowDefinition,
  t: TFunction,
  options?: WorkflowFlowNodeOptions
): Array<Node<TWorkflowNodeData>> => {
  const sourcesWithEdges = new Set(definition.edges.map((edge) => edge.source));
  const isSurveyTrigger = isResponseCompletedTrigger(definition.trigger);
  const resolvedOptions: Required<Omit<WorkflowFlowNodeOptions, "triggerSummary">> = {
    hasBoundSurvey: options?.hasBoundSurvey ?? true,
    isDraft: options?.isDraft ?? true,
  };

  return [...(definition.trigger ? [definition.trigger] : []), ...definition.nodes].map((node, index) => {
    const registryEntry = getNodeRegistryEntry(node);
    const fallbackPosition = { x: 120, y: 80 + index * 120 };

    const isIfElse = node.type === "if_else";
    const isLeaf = !sourcesWithEdges.has(node.id);

    return {
      id: node.id,
      type: isIfElse ? WORKFLOW_BRANCH_NODE_TYPE : WORKFLOW_CANVAS_NODE_TYPE,
      position: node.ui?.position ?? fallbackPosition,
      data: {
        category: registryEntry.category,
        icon: registryEntry.icon,
        nodeType: getWorkflowNodeConcreteType(node) ?? node.type,
        title: registryEntry.title(node, t),
        summary:
          node.type === "trigger" && options?.triggerSummary
            ? options.triggerSummary
            : registryEntry.summary(node, t),
        // The end of the workflow or of a branch: a step with nothing after it. An If/else ends in
        // its branches' own `+` instead.
        canAppendStep: !isIfElse && isLeaf,
        emptyBranches: isIfElse
          ? IF_ELSE_BRANCHES.filter(
              (branch) =>
                !definition.edges.some((edge) => edge.source === node.id && edge.sourceHandle === branch)
            )
          : [],
        issue: getWorkflowNodeIssue(node, t, resolvedOptions, isSurveyTrigger),
      },
    };
  });
};

export const workflowDefinitionToFlowEdges = (definition: TWorkflowDefinition): Edge[] => {
  const ifElseIds = getIfElseNodeIds(definition);

  return definition.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edge.sourceHandle,
    // A branch edge starts at the end of its leg of the If/else fork, which carries the label.
    type: ifElseIds.has(edge.source) ? WORKFLOW_BRANCH_EDGE_TYPE : WORKFLOW_ADD_BUTTON_EDGE_TYPE,
  }));
};

export const snapWorkflowNodePosition = (position: { x: number; y: number }) => ({
  x: Math.round(position.x / WORKFLOW_CANVAS_SNAP_GRID[0]) * WORKFLOW_CANVAS_SNAP_GRID[0],
  y: Math.round(position.y / WORKFLOW_CANVAS_SNAP_GRID[1]) * WORKFLOW_CANVAS_SNAP_GRID[1],
});

export const updateNodePosition = (
  definition: TWorkflowDefinition,
  nodeId: string,
  position: { x: number; y: number }
): TWorkflowDefinition => {
  if (definition.trigger?.id === nodeId) {
    return {
      ...definition,
      trigger: {
        ...definition.trigger,
        ui: { ...definition.trigger.ui, position },
      },
    };
  }

  return {
    ...definition,
    nodes: definition.nodes.map((node) =>
      node.id === nodeId ? { ...node, ui: { ...node.ui, position } } : node
    ),
  };
};

// The children a step lays out below itself, left to right: an If/else's Then branch, then its
// Else branch (null while that branch has no step); any other step's outgoing edges in order.
const getLayoutChildren = (
  node: TWorkflowNode,
  definition: TWorkflowDefinition,
  nodesById: Map<string, TWorkflowNode>
): Array<string | null> => {
  const outgoing = definition.edges.filter((edge) => edge.source === node.id && nodesById.has(edge.target));
  if (node.type !== "if_else") return outgoing.map((edge) => edge.target);
  return IF_ELSE_BRANCHES.map(
    (branch) => outgoing.find((edge) => edge.sourceHandle === branch)?.target ?? null
  );
};

// A tree layout from the trigger: each step sits centered over the columns its subtree needs, an
// If/else puts its Then subtree left of its Else subtree, and an empty branch keeps one column for
// its `+`. A linear workflow stays in one column, where the earlier row layout put it. Unreachable
// steps (and every step of a trigger-less draft) each get their own row below, in original order.
const layoutWorkflowNodes = (
  definition: TWorkflowDefinition,
  nodesById: Map<string, TWorkflowNode>,
  originalNodeOrder: string[]
): Map<string, { x: number; y: number }> => {
  const columnWidth = WORKFLOW_CANVAS_NODE_SPACING.x;
  const widths = new Map<string, number>();
  // Hand-written data can hold a cycle or a join: a step is measured and placed once, at its
  // first visit, so neither recurses forever nor places a step twice.
  const measuring = new Set<string>();

  const getWidth = (nodeId: string | null): number => {
    if (nodeId === null) return 1;
    const known = widths.get(nodeId);
    if (known !== undefined) return known;
    const node = nodesById.get(nodeId);
    if (!node || measuring.has(nodeId)) return 1;
    measuring.add(nodeId);
    const childrenWidth = getLayoutChildren(node, definition, nodesById)
      .map(getWidth)
      .reduce((sum, width) => sum + width, 0);
    measuring.delete(nodeId);
    const width = Math.max(1, childrenWidth);
    widths.set(nodeId, width);
    return width;
  };

  const positions = new Map<string, { x: number; y: number }>();
  let lowestY = WORKFLOW_CANVAS_START_POSITION.y;

  const place = (nodeId: string, left: number, y: number) => {
    const node = nodesById.get(nodeId);
    if (!node || positions.has(nodeId)) return;
    const centerX = left + (getWidth(nodeId) * columnWidth) / 2;
    positions.set(nodeId, { x: centerX - columnWidth / 2, y });
    lowestY = Math.max(lowestY, y);

    const childY =
      y + (node.type === "if_else" ? WORKFLOW_CANVAS_BRANCH_ROW_HEIGHT : WORKFLOW_CANVAS_NODE_SPACING.y);
    let childLeft = left;
    for (const childId of getLayoutChildren(node, definition, nodesById)) {
      if (childId !== null) place(childId, childLeft, childY);
      childLeft += getWidth(childId) * columnWidth;
    }
  };

  if (definition.trigger) {
    const rootWidth = getWidth(definition.trigger.id);
    const rootCenterX = WORKFLOW_CANVAS_START_POSITION.x + columnWidth / 2;
    place(
      definition.trigger.id,
      rootCenterX - (rootWidth * columnWidth) / 2,
      WORKFLOW_CANVAS_START_POSITION.y
    );
  }

  let nextUnreachableY = lowestY + WORKFLOW_CANVAS_NODE_SPACING.y;
  for (const nodeId of originalNodeOrder) {
    if (positions.has(nodeId)) continue;
    positions.set(nodeId, { x: WORKFLOW_CANVAS_START_POSITION.x, y: nextUnreachableY });
    nextUnreachableY += WORKFLOW_CANVAS_NODE_SPACING.y;
  }

  return positions;
};

export const reorganizeWorkflowDefinition = (definition: TWorkflowDefinition): TWorkflowDefinition => {
  const allNodes: TWorkflowNode[] = [
    ...(definition.trigger ? [definition.trigger] : []),
    ...definition.nodes,
  ];
  const nodesById = new Map(allNodes.map((node) => [node.id, node]));
  const originalNodeOrder = allNodes.map((node) => node.id);
  const positionsByNodeId = new Map(
    [...layoutWorkflowNodes(definition, nodesById, originalNodeOrder)].map(([nodeId, position]) => [
      nodeId,
      snapWorkflowNodePosition(position),
    ])
  );

  return {
    ...definition,
    trigger: definition.trigger
      ? {
          ...definition.trigger,
          ui: {
            ...definition.trigger.ui,
            position: positionsByNodeId.get(definition.trigger.id) ?? definition.trigger.ui?.position,
          },
        }
      : null,
    nodes: definition.nodes.map((node) => ({
      ...node,
      ui: {
        ...node.ui,
        position: positionsByNodeId.get(node.id) ?? node.ui?.position,
      },
    })),
  };
};
