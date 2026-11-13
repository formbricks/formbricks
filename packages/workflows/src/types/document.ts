import { z } from "zod";
import { ZWorkflowActionNode } from "./actions";
import { ZWorkflowIfElseNode, flattenWorkflowConditions, getConditionOperatorNameSet } from "./conditions";
import {
  type TWorkflowExecutableCheckContext,
  WORKFLOW_EXECUTABLE_NODE_CHECKS,
  WORKFLOW_TRIGGER_VARIABLE_SOURCES,
} from "./executable-checks";
import { WORKFLOW_LIMITS } from "./limits";
import { validateWorkflowDefinitionSaveRules } from "./save-rules";
import { getWorkflowStepType } from "./steps";
import { ZWorkflowTriggerNode } from "./triggers";

export const WORKFLOW_SCHEMA_VERSION = 1;
export const ZWorkflowSchemaVersion = z
  .number()
  .int()
  .positive()
  .max(WORKFLOW_SCHEMA_VERSION)
  .default(WORKFLOW_SCHEMA_VERSION)
  .describe("Workflow definition schema version understood by this package.");

export const ZWorkflowChildNode = z.union([ZWorkflowActionNode, ZWorkflowIfElseNode]);
export type TWorkflowChildNode = z.infer<typeof ZWorkflowChildNode>;

export const ZWorkflowNode = z.union([ZWorkflowChildNode, ZWorkflowTriggerNode]);
export type TWorkflowNode = z.infer<typeof ZWorkflowNode>;

export const ZWorkflowIfElseBranch = z.enum(["then", "else"]);
export type TWorkflowIfElseBranch = z.infer<typeof ZWorkflowIfElseBranch>;

export const ZWorkflowEdge = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().min(1).optional().describe("Use then or else for if_else source branches."),
  targetHandle: z.string().min(1).optional(),
});
export type TWorkflowEdge = z.infer<typeof ZWorkflowEdge>;

export const ZWorkflowDefinitionBase = z
  .object({
    schemaVersion: ZWorkflowSchemaVersion,
    trigger: ZWorkflowTriggerNode.nullable().describe(
      "Null while the draft has no trigger yet; the user adds one from the canvas."
    ),
    nodes: z.array(ZWorkflowChildNode).default([]),
    edges: z.array(ZWorkflowEdge).default([]),
    entryNodeId: z
      .string()
      .min(1)
      .nullable()
      .describe("Workflow entry point. Must reference the workflow trigger node, or be null without one."),
  })
  .describe("Persisted workflow graph definition.");
export type TWorkflowDefinitionBase = z.infer<typeof ZWorkflowDefinitionBase>;

const validateEdgeReferences = (
  definition: TWorkflowDefinitionBase,
  ids: ReadonlySet<string>,
  nodesById: ReadonlyMap<string, TWorkflowNode>,
  ctx: z.RefinementCtx
): void => {
  for (const [index, edge] of definition.edges.entries()) {
    if (!ids.has(edge.source)) {
      ctx.addIssue({
        code: "custom",
        message: `Edge source does not reference a workflow node: ${edge.source}`,
        path: ["edges", index, "source"],
      });
    }

    if (!ids.has(edge.target)) {
      ctx.addIssue({
        code: "custom",
        message: `Edge target does not reference a workflow node: ${edge.target}`,
        path: ["edges", index, "target"],
      });
    }

    const sourceNode = nodesById.get(edge.source);
    const isIfElseBranch =
      edge.sourceHandle === ZWorkflowIfElseBranch.enum.then ||
      edge.sourceHandle === ZWorkflowIfElseBranch.enum.else;

    if (sourceNode?.type === "if_else" && !isIfElseBranch) {
      ctx.addIssue({
        code: "custom",
        message: "if_else edges must use then or else sourceHandle",
        path: ["edges", index, "sourceHandle"],
      });
    }

    if (sourceNode && sourceNode.type !== "if_else" && isIfElseBranch) {
      ctx.addIssue({
        code: "custom",
        message: "Only if_else nodes can use then or else sourceHandle",
        path: ["edges", index, "sourceHandle"],
      });
    }
  }
};

/** Each If/else branch has at most one edge; a branch with none ends the run on that side. */
const validateIfElseBranches = (definition: TWorkflowDefinitionBase, ctx: z.RefinementCtx): void => {
  for (const node of definition.nodes) {
    if (node.type !== "if_else") {
      continue;
    }

    const outgoingEdges = definition.edges.filter((edge) => edge.source === node.id);
    const thenEdges = outgoingEdges.filter((edge) => edge.sourceHandle === ZWorkflowIfElseBranch.enum.then);
    const elseEdges = outgoingEdges.filter((edge) => edge.sourceHandle === ZWorkflowIfElseBranch.enum.else);

    // An empty branch (no edge) is allowed: the run simply ends on that side.
    if (thenEdges.length > 1) {
      ctx.addIssue({
        code: "custom",
        message: `if_else node ${node.id} can have at most one then edge`,
        path: ["edges"],
      });
    }

    if (elseEdges.length > 1) {
      ctx.addIssue({
        code: "custom",
        message: `if_else node ${node.id} can have at most one else edge`,
        path: ["edges"],
      });
    }
  }
};

const validateBranchesNeverJoin = (definition: TWorkflowDefinitionBase, ctx: z.RefinementCtx): void => {
  // Branches never join again (ADR 0047): with one way in per step, "which Variables exist here"
  // has one answer.
  const incomingCounts = new Map<string, number>();
  for (const edge of definition.edges) {
    incomingCounts.set(edge.target, (incomingCounts.get(edge.target) ?? 0) + 1);
  }
  for (const [nodeId, count] of incomingCounts) {
    if (count > 1 && nodeId !== definition.trigger?.id) {
      ctx.addIssue({
        code: "custom",
        message: `Workflow node ${nodeId} has more than one incoming edge; branches never join`,
        path: ["edges"],
      });
    }
  }
};

const validateWorkflowGraph = (definition: TWorkflowDefinitionBase, ctx: z.RefinementCtx): void => {
  const ids = new Set<string>();
  const nodesById = new Map<string, TWorkflowNode>();
  if (definition.trigger) {
    ids.add(definition.trigger.id);
    nodesById.set(definition.trigger.id, definition.trigger);
  }

  for (const node of definition.nodes) {
    if (ids.has(node.id)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate workflow node id: ${node.id}`,
        path: ["nodes"],
      });
      continue;
    }

    ids.add(node.id);
    nodesById.set(node.id, node);
  }

  if (definition.entryNodeId !== (definition.trigger?.id ?? null)) {
    ctx.addIssue({
      code: "custom",
      message: definition.trigger
        ? "entryNodeId must reference the workflow trigger"
        : "entryNodeId must be null while the workflow has no trigger",
      path: ["entryNodeId"],
    });
  }

  validateEdgeReferences(definition, ids, nodesById, ctx);

  // At most one so trigger-only drafts (no nodes/edges yet) stay persistable;
  // the executable definition requires exactly one.
  const triggerEdges = definition.trigger
    ? definition.edges.filter((edge) => edge.source === definition.trigger?.id)
    : [];
  if (triggerEdges.length > 1) {
    ctx.addIssue({
      code: "custom",
      message: "A workflow can have at most one outgoing trigger edge",
      path: ["edges"],
    });
  }

  validateIfElseBranches(definition, ctx);
  validateConditionOperatorNames(definition, ctx);
};

/**
 * One definition uses one operator name set (ADR 0050): the survey names or the deprecated legacy
 * workflow names, never a mix. Names both sets share (equals, contains) fit either.
 */
const validateConditionOperatorNames = (definition: TWorkflowDefinitionBase, ctx: z.RefinementCtx): void => {
  const sets = new Set<string>();
  for (const node of definition.nodes) {
    if (node.type !== "if_else") continue;
    for (const condition of flattenWorkflowConditions(node.config.condition)) {
      const set = getConditionOperatorNameSet(condition.operator);
      if (set !== "shared") sets.add(set);
    }
  }
  if (sets.size > 1) {
    ctx.addIssue({
      code: "custom",
      message:
        "The definition mixes survey operator names with the deprecated workflow operator names; use one set",
      path: ["nodes"],
    });
  }
};

/**
 * A stored definition as read back: graph references checked, but none of the rules added after
 * drafts could already be saved (save-time limits, the Variable path grammar, branches never join).
 * Output schemas use this, so a definition saved before a rule still loads; writes use
 * `ZWorkflowDefinitionInput`.
 */
export const ZWorkflowDefinition = ZWorkflowDefinitionBase.superRefine(validateWorkflowGraph).describe(
  "Persisted workflow definition with graph references validated."
);
export type TWorkflowDefinition = z.infer<typeof ZWorkflowDefinition>;

/** A definition being saved (create, patch, duplicate): the stored shape plus every save-time rule. */
export const ZWorkflowDefinitionInput = ZWorkflowDefinition.superRefine((definition, ctx) => {
  validateBranchesNeverJoin(definition, ctx);
  validateWorkflowDefinitionSaveRules(definition, ctx);
}).describe(
  `Workflow definition with graph references validated. At most ${WORKFLOW_LIMITS.maxSteps} steps and ${WORKFLOW_LIMITS.maxConditionsPerIfElse} conditions per if_else; branches never join; Variable paths start with payload., steps. or response.`
);

// Executable workflows are the enable-time subset: the trigger (and with it the entry point)
// must exist, so the base's draft-only nullability is tightened back to required here.
const ZWorkflowExecutableDefinitionBase = ZWorkflowDefinitionBase.extend({
  trigger: ZWorkflowTriggerNode,
  entryNodeId: z.string().min(1).describe("Workflow entry point. Must reference the trigger node."),
});
type TWorkflowExecutableDefinitionBase = z.infer<typeof ZWorkflowExecutableDefinitionBase>;

/** No fan-out: only an if_else picks between two next steps; every other step has at most one. */
const validateNoFanOut = (
  outgoingEdgesBySource: ReadonlyMap<string, string[]>,
  nodesById: ReadonlyMap<string, TWorkflowNode>,
  ctx: z.RefinementCtx
): void => {
  for (const [sourceId, targets] of outgoingEdgesBySource) {
    if (targets.length > 1 && nodesById.get(sourceId)?.type !== "if_else") {
      ctx.addIssue({
        code: "custom",
        message: `Workflow node ${sourceId} can have only one next step`,
        path: ["edges"],
      });
    }
  }
};

const validateExecutableGraph = (
  definition: TWorkflowExecutableDefinitionBase,
  ctx: z.RefinementCtx
): void => {
  const triggerEdges = definition.edges.filter((edge) => edge.source === definition.trigger.id);
  if (triggerEdges.length !== 1) {
    ctx.addIssue({
      code: "custom",
      message: "An executable workflow must have exactly one outgoing trigger edge",
      path: ["edges"],
    });
  }

  const nodesById = new Map<string, TWorkflowNode>([[definition.trigger.id, definition.trigger]]);
  for (const node of definition.nodes) {
    nodesById.set(node.id, node);
  }

  const outgoingEdgesBySource = new Map<string, string[]>();
  for (const edge of definition.edges) {
    if (!nodesById.has(edge.source) || !nodesById.has(edge.target)) {
      continue;
    }

    const outgoingTargets = outgoingEdgesBySource.get(edge.source) ?? [];
    outgoingTargets.push(edge.target);
    outgoingEdgesBySource.set(edge.source, outgoingTargets);
  }

  validateNoFanOut(outgoingEdgesBySource, nodesById, ctx);

  const reachableNodeIds = new Set<string>();
  const nodesToVisit = [definition.trigger.id];

  while (nodesToVisit.length > 0) {
    const nodeId = nodesToVisit.pop();
    if (!nodeId || reachableNodeIds.has(nodeId)) {
      continue;
    }

    reachableNodeIds.add(nodeId);

    for (const targetId of outgoingEdgesBySource.get(nodeId) ?? []) {
      nodesToVisit.push(targetId);
    }
  }

  const unreachableNodeIds = definition.nodes
    .map((node) => node.id)
    .filter((nodeId) => !reachableNodeIds.has(nodeId));

  if (unreachableNodeIds.length > 0) {
    ctx.addIssue({
      code: "custom",
      message: `Executable workflow contains unreachable node ids: ${unreachableNodeIds.join(", ")}`,
      path: ["nodes"],
    });
  }

  const visitedNodeIds = new Set<string>();
  const activeNodeIds = new Set<string>();

  const hasCycle = (nodeId: string): boolean => {
    if (activeNodeIds.has(nodeId)) {
      return true;
    }

    if (visitedNodeIds.has(nodeId)) {
      return false;
    }

    visitedNodeIds.add(nodeId);
    activeNodeIds.add(nodeId);

    for (const targetId of outgoingEdgesBySource.get(nodeId) ?? []) {
      if (hasCycle(targetId)) {
        return true;
      }
    }

    activeNodeIds.delete(nodeId);
    return false;
  };

  for (const nodeId of nodesById.keys()) {
    if (hasCycle(nodeId)) {
      ctx.addIssue({
        code: "custom",
        message: "Executable workflow graph must be acyclic",
        path: ["edges"],
      });
      break;
    }
  }
};

/**
 * The ids of the steps on the one path from the trigger to each node (branches never join, so the
 * path is unique). A step may read `steps.<id>` only for these.
 */
const getUpstreamStepIds = (definition: TWorkflowExecutableDefinitionBase): Map<string, Set<string>> => {
  const childNodeIds = new Set(definition.nodes.map((node) => node.id));
  const upstream = new Map<string, Set<string>>([[definition.trigger.id, new Set()]]);
  const queue = [definition.trigger.id];

  while (queue.length > 0) {
    const nodeId = queue.shift() as string;
    const before = upstream.get(nodeId) ?? new Set<string>();
    const forChildren = childNodeIds.has(nodeId) ? new Set([...before, nodeId]) : before;
    for (const edge of definition.edges) {
      if (edge.source !== nodeId || upstream.has(edge.target)) continue;
      upstream.set(edge.target, forChildren);
      queue.push(edge.target);
    }
  }

  return upstream;
};

/** Per-step-type checks (`WORKFLOW_EXECUTABLE_NODE_CHECKS`) run on every node. */
const validateExecutableNodes = (
  definition: TWorkflowExecutableDefinitionBase,
  ctx: z.RefinementCtx
): void => {
  const upstream = getUpstreamStepIds(definition);
  const availableSources = new Set(WORKFLOW_TRIGGER_VARIABLE_SOURCES[definition.trigger.triggerType]);

  for (const [index, node] of definition.nodes.entries()) {
    const context: TWorkflowExecutableCheckContext = {
      upstreamStepIds: upstream.get(node.id) ?? new Set(),
      availableSources,
      addIssue: (message, path = []) =>
        ctx.addIssue({ code: "custom", message, path: ["nodes", index, ...path] }),
    };
    const check = WORKFLOW_EXECUTABLE_NODE_CHECKS[getWorkflowStepType(node)] as (
      node: TWorkflowChildNode,
      context: TWorkflowExecutableCheckContext
    ) => void;
    check(node, context);
  }
};

export const ZWorkflowExecutableDefinition = ZWorkflowExecutableDefinitionBase.superRefine(
  (definition, ctx) => {
    validateWorkflowGraph(definition, ctx);
    validateBranchesNeverJoin(definition, ctx);
    validateExecutableGraph(definition, ctx);
    validateExecutableNodes(definition, ctx);
  }
).describe("Workflow definition subset that the current runner can execute.");
export type TWorkflowExecutableDefinition = z.infer<typeof ZWorkflowExecutableDefinition>;

/**
 * What enable (and a test of it) checks: executable, plus the save-time rules. The runner and the
 * run resources use `ZWorkflowExecutableDefinition`, so a live version saved before a rule keeps running.
 */
export const ZWorkflowEnableDefinition = ZWorkflowExecutableDefinition.superRefine(
  validateWorkflowDefinitionSaveRules
);
