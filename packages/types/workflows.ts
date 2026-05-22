import { z } from "zod";

export const ZWorkflowStatus = z.enum(["draft", "enabled", "disabled"]);
export const ZWorkflowRunStatus = z.enum(["queued", "running", "completed", "failed", "canceled"]);
export const ZWorkflowTriggerType = z.enum(["response.completed"]);
export const ZWorkflowNodeType = z.enum(["ifElse", "action"]);
export const ZWorkflowActionType = z.enum(["sendEmailPreview", "sendWebhookPreview"]);
export const ZDeferredWorkflowActionType = z.enum(["compute"]);

export const ZWorkflowNodePosition = z.object({
  x: z.number(),
  y: z.number(),
});

export const ZWorkflowNodeUi = z
  .object({
    position: ZWorkflowNodePosition.optional(),
  })
  .optional();

export const ZWorkflowDataRef = z.object({
  type: z.literal("ref"),
  path: z.string().min(1),
});

export const ZResponseCompletedTriggerConfig = z.object({
  type: z.literal("response.completed"),
  surveyId: z.cuid2().nullable().optional(),
});

export const ZWorkflowTriggerNode = z.object({
  id: z.string().min(1),
  type: z.literal("trigger"),
  config: ZResponseCompletedTriggerConfig,
  ui: ZWorkflowNodeUi,
});

export const ZWorkflowConditionOperator = z.enum([
  "equals",
  "notEquals",
  "lessThan",
  "lessEqual",
  "greaterThan",
  "greaterEqual",
  "contains",
  "doesNotContain",
  "isEmpty",
  "isNotEmpty",
]);

export const ZWorkflowConditionValue = z.union([z.string(), z.number(), z.boolean(), ZWorkflowDataRef]);

export type TWorkflowCondition = {
  id: string;
  left: z.infer<typeof ZWorkflowDataRef>;
  operator: z.infer<typeof ZWorkflowConditionOperator>;
  right?: z.infer<typeof ZWorkflowConditionValue>;
};

export type TWorkflowConditionGroup = {
  id: string;
  connector: "and" | "or";
  conditions: Array<TWorkflowCondition | TWorkflowConditionGroup>;
};

export const ZWorkflowCondition: z.ZodType<TWorkflowCondition> = z.object({
  id: z.string().min(1),
  left: ZWorkflowDataRef,
  operator: ZWorkflowConditionOperator,
  right: ZWorkflowConditionValue.optional(),
});

export const ZWorkflowConditionGroup: z.ZodType<TWorkflowConditionGroup> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    connector: z.enum(["and", "or"]),
    conditions: z.array(z.union([ZWorkflowCondition, ZWorkflowConditionGroup])).min(1),
  })
);

export const ZIfElseNode = z.object({
  id: z.string().min(1),
  type: z.literal("ifElse"),
  config: z.object({
    condition: ZWorkflowConditionGroup,
  }),
  ui: ZWorkflowNodeUi,
});

export const ZSendEmailPreviewActionConfig = z.object({
  to: z.string().min(1),
  replyTo: z.array(z.email()).default([]),
  subject: z.string().min(1),
  body: z.string().min(1),
  includeResponseData: z.boolean().default(false),
});

export const ZSendWebhookPreviewActionConfig = z.object({
  url: z.url(),
  method: z.literal("POST").default("POST"),
  headers: z.record(z.string(), z.string()).default({}),
});

export const ZSendEmailPreviewActionNode = z.object({
  id: z.string().min(1),
  type: z.literal("action"),
  actionType: z.literal("sendEmailPreview"),
  config: ZSendEmailPreviewActionConfig,
  ui: ZWorkflowNodeUi,
});

export const ZSendWebhookPreviewActionNode = z.object({
  id: z.string().min(1),
  type: z.literal("action"),
  actionType: z.literal("sendWebhookPreview"),
  config: ZSendWebhookPreviewActionConfig,
  ui: ZWorkflowNodeUi,
});

export const ZWorkflowActionNode = z.discriminatedUnion("actionType", [
  ZSendEmailPreviewActionNode,
  ZSendWebhookPreviewActionNode,
]);

export const ZWorkflowNode = z.union([ZIfElseNode, ZWorkflowActionNode]);

export const ZWorkflowEdge = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  branch: z.enum(["then", "else", "next"]).default("next"),
});

export const ZWorkflowDefinition = z
  .object({
    schemaVersion: z.literal(1),
    trigger: ZWorkflowTriggerNode,
    nodes: z.array(ZWorkflowNode),
    edges: z.array(ZWorkflowEdge),
    entryNodeId: z.string().min(1),
  })
  .superRefine((definition, ctx) => {
    const parsedNodes = definition.nodes.filter(
      (node): node is TWorkflowNode =>
        Boolean(node) && typeof node === "object" && "id" in node && typeof node.id === "string"
    );

    if (definition.entryNodeId !== definition.trigger.id) {
      ctx.addIssue({
        code: "custom",
        path: ["entryNodeId"],
        message: "The entry node must be the workflow trigger.",
      });
    }

    const ids = [definition.trigger.id, ...parsedNodes.map((node) => node.id)];
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    for (const duplicateId of new Set(duplicateIds)) {
      ctx.addIssue({
        code: "custom",
        path: ["nodes"],
        message: `Duplicate workflow node id: ${duplicateId}`,
      });
    }

    const idSet = new Set(ids);
    for (const [index, edge] of definition.edges.entries()) {
      if (!idSet.has(edge.source)) {
        ctx.addIssue({
          code: "custom",
          path: ["edges", index, "source"],
          message: `Unknown edge source: ${edge.source}`,
        });
      }

      if (!idSet.has(edge.target)) {
        ctx.addIssue({
          code: "custom",
          path: ["edges", index, "target"],
          message: `Unknown edge target: ${edge.target}`,
        });
      }

      const sourceNode =
        edge.source === definition.trigger.id
          ? definition.trigger
          : parsedNodes.find((node) => node.id === edge.source);
      if (sourceNode?.type === "ifElse" && edge.branch === "next") {
        ctx.addIssue({
          code: "custom",
          path: ["edges", index, "branch"],
          message: "If/Else edges must use then or else branches.",
        });
      }

      if (sourceNode?.type !== "ifElse" && edge.branch !== "next") {
        ctx.addIssue({
          code: "custom",
          path: ["edges", index, "branch"],
          message: "Only If/Else nodes can use then or else branches.",
        });
      }
    }

    const triggerEdges = definition.edges.filter((edge) => edge.source === definition.trigger.id);
    if (triggerEdges.length !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["edges"],
        message: "A PoC workflow must have exactly one outgoing trigger edge.",
      });
    }

    for (const ifElseNode of parsedNodes.filter((node) => node.type === "ifElse")) {
      const outgoingEdges = definition.edges.filter((edge) => edge.source === ifElseNode.id);
      if (outgoingEdges.filter((edge) => edge.branch === "then").length !== 1) {
        ctx.addIssue({
          code: "custom",
          path: ["edges"],
          message: `If/Else node ${ifElseNode.id} must have exactly one then edge.`,
        });
      }

      if (outgoingEdges.filter((edge) => edge.branch === "else").length !== 1) {
        ctx.addIssue({
          code: "custom",
          path: ["edges"],
          message: `If/Else node ${ifElseNode.id} must have exactly one else edge.`,
        });
      }
    }
  });

export const ZWorkflowStepResult = z.object({
  nodeId: z.string().min(1),
  status: z.enum(["completed", "failed", "skipped"]),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
});

export const ZWorkflowRunLog = z.object({
  level: z.enum(["info", "warn", "error"]),
  message: z.string(),
  timestamp: z.string().datetime(),
  nodeId: z.string().optional(),
});

export const ZWorkflowRunData = z.object({
  triggerPayload: z.unknown().optional(),
  steps: z.array(ZWorkflowStepResult).default([]),
  finalOutput: z.unknown().optional(),
  logs: z.array(ZWorkflowRunLog).default([]),
});

export const ZWorkflowTriggerPayload = z.object({
  event: z.literal("response.completed"),
  workspaceId: z.cuid2(),
  surveyId: z.cuid2(),
  response: z.unknown(),
});

export type TWorkflowStatus = z.infer<typeof ZWorkflowStatus>;
export type TWorkflowRunStatus = z.infer<typeof ZWorkflowRunStatus>;
export type TWorkflowTriggerType = z.infer<typeof ZWorkflowTriggerType>;
export type TWorkflowActionType = z.infer<typeof ZWorkflowActionType>;
export type TWorkflowDataRef = z.infer<typeof ZWorkflowDataRef>;
export type TWorkflowTriggerNode = z.infer<typeof ZWorkflowTriggerNode>;
export type TWorkflowNode = z.infer<typeof ZWorkflowNode>;
export type TWorkflowActionNode = z.infer<typeof ZWorkflowActionNode>;
export type TIfElseNode = z.infer<typeof ZIfElseNode>;
export type TWorkflowEdge = z.infer<typeof ZWorkflowEdge>;
export type TWorkflowDefinition = z.infer<typeof ZWorkflowDefinition>;
export type TWorkflowStepResult = z.infer<typeof ZWorkflowStepResult>;
export type TWorkflowRunData = z.infer<typeof ZWorkflowRunData>;
export type TWorkflowTriggerPayload = z.infer<typeof ZWorkflowTriggerPayload>;
