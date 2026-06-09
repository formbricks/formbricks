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
  .default(WORKFLOW_SCHEMA_VERSION);

export const ZWorkflowChildNode = z.union([ZWorkflowActionNode, ZWorkflowIfElseNode]);
export type TWorkflowChildNode = z.infer<typeof ZWorkflowChildNode>;

export const ZWorkflowNode = z.union([ZWorkflowChildNode, ZWorkflowTriggerNode]);
export type TWorkflowNode = z.infer<typeof ZWorkflowNode>;

export const ZWorkflowEdge = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().min(1).optional(),
  targetHandle: z.string().min(1).optional(),
});
export type TWorkflowEdge = z.infer<typeof ZWorkflowEdge>;

export const ZWorkflowDefinitionBase = z.object({
  schemaVersion: ZWorkflowSchemaVersion,
  trigger: ZWorkflowTriggerNode,
  nodes: z.array(ZWorkflowChildNode).default([]),
  edges: z.array(ZWorkflowEdge).default([]),
  entryNodeId: z.string().min(1),
});
export type TWorkflowDefinitionBase = z.infer<typeof ZWorkflowDefinitionBase>;

const validateWorkflowGraph = (definition: TWorkflowDefinitionBase, ctx: z.RefinementCtx): void => {
  const ids = new Set<string>([definition.trigger.id]);

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
  }

  if (!ids.has(definition.entryNodeId)) {
    ctx.addIssue({
      code: "custom",
      message: "entryNodeId must reference the trigger or a workflow node",
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
  }
};

export const ZWorkflowDefinition = ZWorkflowDefinitionBase.superRefine(validateWorkflowGraph);
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
});
export type TWorkflowExecutableDefinition = z.infer<typeof ZWorkflowExecutableDefinition>;
