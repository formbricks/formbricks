import { type Edge, type Node, type SnapGrid } from "@xyflow/react";
import type { TFunction } from "i18next";
import {
  type TWorkflowCondition,
  type TWorkflowConditionGroup,
  type TWorkflowDefinition,
  type TWorkflowNode,
  WORKFLOW_SWITCH_DEFAULT_BRANCH,
  getBlankSendEmailContentFields,
  getWorkflowNodeConcreteType,
  isConditionStepNode,
  isResponseCompletedTrigger,
} from "@formbricks/workflows";
import {
  type TWorkflowCanvasDirection,
  WORKFLOW_CANVAS_BRANCH_ROW_HEIGHT,
  WORKFLOW_CANVAS_HORIZONTAL,
  WORKFLOW_CANVAS_NODE_SPACING,
  WORKFLOW_CANVAS_START_POSITION,
  getBranchLegOffsets,
  getBranchSpread,
} from "@/modules/ee/workflows/lib/canvas-geometry";
import type { TChoiceLabels } from "@/modules/ee/workflows/lib/choice-conditions";
import { getNodeRegistryEntry } from "@/modules/ee/workflows/lib/node-registry";
import {
  type TVariableRefs,
  describeIfElseConditionParts,
  describeSwitchParts,
} from "@/modules/ee/workflows/lib/summary-parts";
import type { TVariableLabels } from "@/modules/ee/workflows/lib/variable-name";
import { getBranchHandles, isBranchingStep } from "@/modules/ee/workflows/lib/workflow-steps";
import type {
  TWorkflowCanvasBranch,
  TWorkflowNodeData,
  TWorkflowNodeIssue,
} from "@/modules/ee/workflows/state/editor";
import type { TFlowTextPart } from "@/modules/survey/editor/lib/reference-chips";

export const WORKFLOW_CANVAS_NODE_TYPE = "workflowCanvasNode";
export const WORKFLOW_BRANCH_NODE_TYPE = "workflowBranchNode";
export const WORKFLOW_ADD_BUTTON_EDGE_TYPE = "addButton";
export const WORKFLOW_BRANCH_EDGE_TYPE = "branch";

export const WORKFLOW_CANVAS_SNAP_GRID: SnapGrid = [20, 20];

interface WorkflowFlowNodeOptions {
  /** Which way steps saved without a position are laid out; top to bottom by default. */
  direction?: TWorkflowCanvasDirection;
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
  /** Human names for Variable paths (a survey question's headline), so summaries never show ids. */
  variableLabels?: TVariableLabels;
  /** How Variables draw as chips in summaries (a question with its icon, a field). */
  variableRefs?: TVariableRefs;
  /** Choice questions' choice labels, so picked choices (DC11) read by name, never by id. */
  choiceLabels?: TChoiceLabels;
}

// Client-side counterpart of the dry-run test's checks: flags nodes that can't run as configured.
// Sequential guidance: while the survey is missing only the trigger carries a flag — the email
// step can't be configured until a survey exists, so flagging it too is just noise.
const getWorkflowNodeIssue = (
  node: TWorkflowNode,
  t: TFunction,
  options: Required<
    Omit<
      WorkflowFlowNodeOptions,
      "triggerSummary" | "variableLabels" | "variableRefs" | "choiceLabels" | "direction"
    >
  >,
  isSurveyTrigger: boolean
): TWorkflowNodeIssue | null => {
  const severity = options.isDraft ? "setup" : "error";
  // Only a Response completed trigger waits for a survey; a Webhook workflow never does.
  const isWaitingForSurvey = isSurveyTrigger && !options.hasBoundSurvey;

  if (node.type === "trigger" && isWaitingForSurvey) {
    return { severity, label: t("workspace.workflows.node_needs_survey") };
  }
  if (node.type === "action" && node.actionType === "send_email" && !isWaitingForSurvey) {
    // Same completeness rule ZWorkflowEnableDefinition enforces server-side on enable/test,
    // including its rich-text handling of the body (see isBlankWorkflowRichText).
    if (getBlankSendEmailContentFields(node.config).length > 0) {
      return { severity, label: t("workspace.workflows.node_needs_email_content") };
    }
  }
  return null;
};

const getBranchingNodeIds = (definition: TWorkflowDefinition) =>
  new Set(definition.nodes.filter(isBranchingStep).map((node) => node.id));

/**
 * The legs of a branching step's fork, left to right, each with its plain label (ED8: no icons): Then
 * and Else, or each Switch case by its name ("Case 2" while it has none) and Default.
 */
export const getCanvasBranches = (node: TWorkflowNode, t: TFunction): TWorkflowCanvasBranch[] => {
  if (node.type === "if_else") {
    return [
      {
        handle: "then",
        label: t("workspace.workflows.branch_then"),
        ariaLabel: t("workspace.workflows.branch_then_aria"),
        addStepLabel: t("workspace.workflows.add_step_to_then_branch"),
      },
      {
        handle: "else",
        label: t("workspace.workflows.branch_else"),
        ariaLabel: t("workspace.workflows.branch_else_aria"),
        addStepLabel: t("workspace.workflows.add_step_to_else_branch"),
      },
    ];
  }
  if (node.type !== "switch") return [];
  const named = (handle: string, label: string): TWorkflowCanvasBranch => ({
    handle,
    label,
    ariaLabel: t("workspace.workflows.switch_branch_aria", { name: label }),
    addStepLabel: t("workspace.workflows.add_step_to_switch_branch", { name: label }),
  });
  return [
    ...node.config.cases.map((switchCase, index) =>
      named(
        switchCase.id,
        switchCase.name.trim() || t("workspace.workflows.switch_case_name_default", { number: index + 1 })
      )
    ),
    named(WORKFLOW_SWITCH_DEFAULT_BRANCH, t("workspace.workflows.switch_default")),
  ];
};

const STEP_VARIABLE_PATH = /^steps\.([^.]+)\.(.+)$/;

const collectConditionPaths = (group: TWorkflowConditionGroup, paths: Set<string>): void => {
  for (const item of group.conditions) {
    if ("conditions" in item) {
      collectConditionPaths(item, paths);
      continue;
    }
    const condition: TWorkflowCondition = item;
    paths.add(condition.left.path);
    const right = condition.right;
    if (right !== null && typeof right === "object" && !Array.isArray(right) && "path" in right) {
      paths.add(right.path);
    }
  }
};

/**
 * The summaries' labels plus one for each step Variable an If/else or Switch compares: the step's name
 * and the field, "Log the visit in the CRM · body.json.club", never the step's id. The chips show the
 * field alone, as the picker does; the plain summary, which is the card's tooltip, says which step.
 */
const withStepVariableLabels = (
  definition: TWorkflowDefinition,
  t: TFunction,
  labels: TVariableLabels | undefined
): TVariableLabels => {
  const paths = new Set<string>();
  for (const node of definition.nodes) {
    if (isConditionStepNode(node)) collectConditionPaths(node.config.condition, paths);
    if (node.type === "switch") paths.add(node.config.left.path);
  }
  const titles = new Map(
    definition.nodes.map((node) => [node.id, getNodeRegistryEntry(node).title(node, t)])
  );
  const result = new Map(labels ?? []);
  for (const path of paths) {
    const match = STEP_VARIABLE_PATH.exec(path);
    const title = match ? titles.get(match[1]) : undefined;
    if (match && title !== undefined && !result.has(path)) result.set(path, `${title} · ${match[2]}`);
  }
  return result;
};

/** The If/else, Filter and Switch summaries as sentences with chips; null for every other step. */
const getSummaryParts = (
  node: TWorkflowNode,
  t: TFunction,
  refs: TVariableRefs | undefined,
  choiceLabels: TChoiceLabels | undefined
): TFlowTextPart[] | null => {
  if (isConditionStepNode(node)) {
    return describeIfElseConditionParts(node.config.condition, t, refs, choiceLabels);
  }
  if (node.type === "switch")
    return describeSwitchParts(node.config.left.path, node.config.cases.length, t, refs);
  return null;
};

export const workflowDefinitionToFlowNodes = (
  definition: TWorkflowDefinition,
  t: TFunction,
  options?: WorkflowFlowNodeOptions
): Array<Node<TWorkflowNodeData>> => {
  const sourcesWithEdges = new Set(definition.edges.map((edge) => edge.source));
  const isSurveyTrigger = isResponseCompletedTrigger(definition.trigger);
  const resolvedOptions: Required<
    Omit<
      WorkflowFlowNodeOptions,
      "triggerSummary" | "variableLabels" | "variableRefs" | "choiceLabels" | "direction"
    >
  > = {
    hasBoundSurvey: options?.hasBoundSurvey ?? true,
    isDraft: options?.isDraft ?? true,
  };

  const variableLabels = withStepVariableLabels(definition, t, options?.variableLabels);
  const allNodes = [...(definition.trigger ? [definition.trigger] : []), ...definition.nodes];
  // Steps saved without a position (created through API v3 or MCP) take the tree layout Auto layout
  // uses, so branches sit side by side instead of stacking in one column under their If/else.
  const layoutPositions = allNodes.some((node) => !node.ui?.position)
    ? layoutWorkflowNodes(
        definition,
        new Map(allNodes.map((node) => [node.id, node])),
        allNodes.map((node) => node.id),
        options?.direction
      )
    : null;

  return allNodes.map((node, index) => {
    const registryEntry = getNodeRegistryEntry(node);
    const laidOut = layoutPositions?.get(node.id);
    const fallbackPosition = laidOut ? snapWorkflowNodePosition(laidOut) : { x: 120, y: 80 + index * 120 };

    const branchHandles = getBranchHandles(node);
    const isLeaf = !sourcesWithEdges.has(node.id);

    return {
      id: node.id,
      type: branchHandles ? WORKFLOW_BRANCH_NODE_TYPE : WORKFLOW_CANVAS_NODE_TYPE,
      position: node.ui?.position ?? fallbackPosition,
      data: {
        category: registryEntry.category,
        icon: registryEntry.icon,
        nodeType: getWorkflowNodeConcreteType(node) ?? node.type,
        title: registryEntry.title(node, t),
        summary:
          node.type === "trigger" && options?.triggerSummary
            ? options.triggerSummary
            : registryEntry.summary(node, t, variableLabels),
        summaryParts: getSummaryParts(node, t, options?.variableRefs, options?.choiceLabels),
        // The end of the workflow or of a branch: a step with nothing after it. An If/else or a
        // Switch ends in its branches' own `+` instead.
        canAppendStep: !branchHandles && isLeaf,
        branches: getCanvasBranches(node, t),
        emptyBranches: (branchHandles ?? []).filter(
          (branch) =>
            !definition.edges.some((edge) => edge.source === node.id && edge.sourceHandle === branch)
        ),
        issue: getWorkflowNodeIssue(node, t, resolvedOptions, isSurveyTrigger),
      },
    };
  });
};

export const workflowDefinitionToFlowEdges = (definition: TWorkflowDefinition): Edge[] => {
  const branchingIds = getBranchingNodeIds(definition);

  return definition.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edge.sourceHandle,
    // A branch edge starts at the end of its leg of the fork, which carries the label.
    type: branchingIds.has(edge.source) ? WORKFLOW_BRANCH_EDGE_TYPE : WORKFLOW_ADD_BUTTON_EDGE_TYPE,
  }));
};

/**
 * Gives each If/else and Switch on the canvas the x offsets of its fork's legs (see getBranchLegOffsets),
 * from where the canvas has its steps right now, so each leg sits straight above its branch's first
 * step even while the user drags it. Steps without branches come back as they were.
 */
export const withBranchLegOffsets = <TNode extends Node<TWorkflowNodeData>>(
  nodes: TNode[],
  edges: ReadonlyArray<Pick<Edge, "source" | "target" | "sourceHandle">>,
  direction: TWorkflowCanvasDirection = "vertical",
  /** A card being moved onto a `+`: the legs stay where it was, so the `+` on them hold still. */
  frozen?: { id: string; position: { x: number; y: number } } | null
): TNode[] => {
  // Left to right, the legs spread down: offsets are along y.
  const axis = direction === "horizontal" ? "y" : "x";
  const coordinateOf = (node: TNode) =>
    frozen?.id === node.id ? frozen.position[axis] : node.position[axis];
  const coordinateById = new Map(nodes.map((node) => [node.id, coordinateOf(node)]));
  return nodes.map((node) => {
    if (node.data.branches.length === 0) return node;
    const childOffsets = node.data.branches.map(({ handle }) => {
      const edge = edges.find((item) => item.source === node.id && item.sourceHandle === handle);
      const childCoordinate = edge ? coordinateById.get(edge.target) : undefined;
      return childCoordinate === undefined ? null : childCoordinate - coordinateOf(node);
    });
    return {
      ...node,
      data: { ...node.data, legOffsets: getBranchLegOffsets(childOffsets, getBranchSpread(direction)) },
    };
  });
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

// The children a step lays out below itself, left to right: an If/else's Then and Else branches, or
// a Switch's cases and Default (null while a branch has no step); any other step's outgoing edges.
const getLayoutChildren = (
  node: TWorkflowNode,
  definition: TWorkflowDefinition,
  nodesById: Map<string, TWorkflowNode>
): Array<string | null> => {
  const outgoing = definition.edges.filter((edge) => edge.source === node.id && nodesById.has(edge.target));
  const branchHandles = getBranchHandles(node);
  if (!branchHandles) return outgoing.map((edge) => edge.target);
  return branchHandles.map((branch) => outgoing.find((edge) => edge.sourceHandle === branch)?.target ?? null);
};

// A tree layout from the trigger: each step sits centered over the columns its subtree needs, a
// branching step puts its branches' subtrees left to right, and an empty branch keeps one column for
// its `+`. A linear workflow stays in one column, where the earlier row layout put it. Unreachable
// steps (and every step of a trigger-less draft) each get their own row below, in original order.
const layoutWorkflowNodes = (
  definition: TWorkflowDefinition,
  nodesById: Map<string, TWorkflowNode>,
  originalNodeOrder: string[],
  direction: TWorkflowCanvasDirection = "vertical"
): Map<string, { x: number; y: number }> => {
  const isHorizontal = direction === "horizontal";
  // The tree grows along `depth` (down, or right) and spreads its branches along `breadth`.
  const breadthUnit = isHorizontal ? WORKFLOW_CANVAS_HORIZONTAL.rowHeight : WORKFLOW_CANVAS_NODE_SPACING.x;
  const depthStep = isHorizontal ? WORKFLOW_CANVAS_HORIZONTAL.stepWidth : WORKFLOW_CANVAS_NODE_SPACING.y;
  const branchDepthStep = isHorizontal
    ? WORKFLOW_CANVAS_HORIZONTAL.branchStepWidth
    : WORKFLOW_CANVAS_BRANCH_ROW_HEIGHT;
  const toPosition = (depth: number, breadth: number) =>
    isHorizontal ? { x: depth, y: breadth } : { x: breadth, y: depth };
  const start = isHorizontal
    ? { depth: WORKFLOW_CANVAS_START_POSITION.y, breadth: WORKFLOW_CANVAS_START_POSITION.y }
    : { depth: WORKFLOW_CANVAS_START_POSITION.y, breadth: WORKFLOW_CANVAS_START_POSITION.x };

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

  const place = (nodeId: string, left: number, depth: number) => {
    const node = nodesById.get(nodeId);
    if (!node || positions.has(nodeId)) return;
    const center = left + (getWidth(nodeId) * breadthUnit) / 2;
    positions.set(nodeId, toPosition(depth, center - breadthUnit / 2));

    const childDepth = depth + (isBranchingStep(node) ? branchDepthStep : depthStep);
    let childLeft = left;
    for (const childId of getLayoutChildren(node, definition, nodesById)) {
      if (childId !== null) place(childId, childLeft, childDepth);
      childLeft += getWidth(childId) * breadthUnit;
    }
  };

  if (definition.trigger) {
    const rootWidth = getWidth(definition.trigger.id);
    const rootCenter = start.breadth + breadthUnit / 2;
    place(definition.trigger.id, rootCenter - (rootWidth * breadthUnit) / 2, start.depth);
  }

  // Unreachable steps (and every step of a trigger-less draft) each get their own row below the rest.
  const lowestY = Math.max(
    WORKFLOW_CANVAS_START_POSITION.y,
    ...[...positions.values()].map((position) => position.y)
  );
  let nextUnreachableY = lowestY + WORKFLOW_CANVAS_NODE_SPACING.y;
  for (const nodeId of originalNodeOrder) {
    if (positions.has(nodeId)) continue;
    positions.set(nodeId, { x: WORKFLOW_CANVAS_START_POSITION.x, y: nextUnreachableY });
    nextUnreachableY += WORKFLOW_CANVAS_NODE_SPACING.y;
  }

  return positions;
};

/** Whether two definitions place every step (and the trigger) at the same spot on the canvas. */
export const haveSameNodePositions = (a: TWorkflowDefinition, b: TWorkflowDefinition): boolean => {
  const positionsOf = (definition: TWorkflowDefinition) =>
    JSON.stringify(
      [...(definition.trigger ? [definition.trigger] : []), ...definition.nodes].map((node) => [
        node.id,
        node.ui?.position ?? null,
      ])
    );
  return positionsOf(a) === positionsOf(b);
};

export const reorganizeWorkflowDefinition = (
  definition: TWorkflowDefinition,
  direction: TWorkflowCanvasDirection = "vertical"
): TWorkflowDefinition => {
  const allNodes: TWorkflowNode[] = [
    ...(definition.trigger ? [definition.trigger] : []),
    ...definition.nodes,
  ];
  const nodesById = new Map(allNodes.map((node) => [node.id, node]));
  const originalNodeOrder = allNodes.map((node) => node.id);
  const positionsByNodeId = new Map(
    [...layoutWorkflowNodes(definition, nodesById, originalNodeOrder, direction)].map(
      ([nodeId, position]) => [nodeId, snapWorkflowNodePosition(position)]
    )
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
