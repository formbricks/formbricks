import { z } from "zod";
import { ZWorkflowActionNode } from "./actions";
import { ZWorkflowIfElseNode } from "./conditions";
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
    trigger: ZWorkflowTriggerNode,
    nodes: z.array(ZWorkflowChildNode).default([]),
    edges: z.array(ZWorkflowEdge).default([]),
    entryNodeId: z.string().min(1).describe("Node id where execution starts after the trigger fires."),
  })
  .describe("Persisted workflow graph definition.");
export type TWorkflowDefinitionBase = z.infer<typeof ZWorkflowDefinitionBase>;

const validateWorkflowGraph = (definition: TWorkflowDefinitionBase, ctx: z.RefinementCtx): void => {
  const ids = new Set<string>([definition.trigger.id]);
  const nodesById = new Map<string, TWorkflowNode>([[definition.trigger.id, definition.trigger]]);

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

  if (definition.entryNodeId !== definition.trigger.id) {
    ctx.addIssue({
      code: "custom",
      message: "entryNodeId must reference the workflow trigger",
      path: ["entryNodeId"],
    });
  }

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

  const triggerEdges = definition.edges.filter((edge) => edge.source === definition.trigger.id);
  if (triggerEdges.length !== 1) {
    ctx.addIssue({
      code: "custom",
      message: "A workflow must have exactly one outgoing trigger edge",
      path: ["edges"],
    });
  }

  for (const node of definition.nodes) {
    if (node.type !== "if_else") {
      continue;
    }

    const outgoingEdges = definition.edges.filter((edge) => edge.source === node.id);
    const thenEdges = outgoingEdges.filter((edge) => edge.sourceHandle === ZWorkflowIfElseBranch.enum.then);
    const elseEdges = outgoingEdges.filter((edge) => edge.sourceHandle === ZWorkflowIfElseBranch.enum.else);

    if (thenEdges.length !== 1) {
      ctx.addIssue({
        code: "custom",
        message: `if_else node ${node.id} must have exactly one then edge`,
        path: ["edges"],
      });
    }

    if (elseEdges.length !== 1) {
      ctx.addIssue({
        code: "custom",
        message: `if_else node ${node.id} must have exactly one else edge`,
        path: ["edges"],
      });
    }
  }
};

export const ZWorkflowDefinition = ZWorkflowDefinitionBase.superRefine(validateWorkflowGraph).describe(
  "Persisted workflow definition with graph references validated."
);
export type TWorkflowDefinition = z.infer<typeof ZWorkflowDefinition>;

export const ZWorkflowExecutableDefinition = ZWorkflowDefinitionBase.superRefine((definition, ctx) => {
  validateWorkflowGraph(definition, ctx);

  for (const [index, node] of definition.nodes.entries()) {
    if (node.type === "if_else") {
      ctx.addIssue({
        code: "custom",
        message: "if_else nodes are not executable in this version of workflows",
        path: ["nodes", index, "type"],
      });
    }
  }
}).describe("Workflow definition subset that the Scope 1 runner can execute.");
export type TWorkflowExecutableDefinition = z.infer<typeof ZWorkflowExecutableDefinition>;
