# Research: Workflows Schema Sketch

| Field      | Value                                                                      |
| ---------- | -------------------------------------------------------------------------- |
| Status     | Done                                                                       |
| Date       | 2026-05-22                                                                 |
| Source     | [001-000](../../cowork/plans/001-000-prototype-readiness-and-contracts.md) |
| Next input | [001-010](../../cowork/plans/001-010-workflows-poc-vertical-slice.md)      |

## Placement

Put shared browser-safe schemas in `packages/types/workflows/` or `packages/types/workflows.ts`.

This follows existing client-safe schema patterns in `@formbricks/types`, such as response and survey schemas.
Do not import Prisma, auth helpers, env access, server-only modules, route helpers, or Node-only APIs from the
shared schema layer.

Database row zod schemas, if needed for generated API docs later, can live in `packages/database/zod/workflows.ts`.

## Core Vocabulary

```ts
export const ZWorkflowStatus = z.enum(["draft", "enabled", "disabled"]);
export const ZWorkflowRunStatus = z.enum(["queued", "running", "completed", "failed", "canceled"]);
export const ZWorkflowTriggerType = z.enum(["response.completed"]);
export const ZWorkflowNodeType = z.enum(["trigger", "ifElse", "action"]);
export const ZWorkflowActionType = z.enum(["sendEmailPreview", "sendWebhookPreview"]);
export const ZDeferredWorkflowActionType = z.enum(["compute"]);
```

`ZWorkflowActionType` is the PoC action vocabulary. Deferred action types such as `compute` can be sketched in
this document for Beta continuity, but they must not be accepted by the PoC workflow definition schema.

## Workflow Definition JSON

Sketch:

```ts
export const ZWorkflowDefinition = z.object({
  schemaVersion: z.literal(1),
  trigger: ZWorkflowTriggerNode,
  nodes: z.array(ZWorkflowNode),
  edges: z.array(ZWorkflowEdge),
  entryNodeId: z.string().min(1),
});
```

Rules:

- `trigger.id` must match `entryNodeId` or be the only trigger node.
- Node IDs are stable and unique inside one definition.
- Edges reference existing node IDs.
- React Flow node positions are not required in the source-of-truth definition. If needed for the PoC, keep
  optional `ui.position` metadata inside nodes and treat it as layout metadata, not execution semantics.

## Trigger Node

```ts
export const ZResponseCompletedTriggerConfig = z.object({
  type: z.literal("response.completed"),
  surveyId: z.cuid2().nullable().optional(),
});

export const ZWorkflowTriggerNode = z.object({
  id: z.string().min(1),
  type: z.literal("trigger"),
  config: ZResponseCompletedTriggerConfig,
});
```

`surveyId` can be nullable/optional to mean "all surveys in this workspace" if the UI supports it. The PoC can
start with one selected survey for a tighter demo.

## Branch Node

Reuse the existing Conditions Editor concept rather than inventing a separate condition language.

```ts
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

export const ZWorkflowDataRef = z.object({
  type: z.literal("ref"),
  path: z.string().min(1),
});

export const ZWorkflowConditionValue = z.union([z.string(), z.number(), z.boolean(), ZWorkflowDataRef]);

export const ZWorkflowCondition = z.object({
  id: z.string().min(1),
  left: ZWorkflowDataRef,
  operator: ZWorkflowConditionOperator,
  right: ZWorkflowConditionValue.optional(),
});

export const ZWorkflowConditionGroup: z.ZodTypeAny = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    connector: z.enum(["and", "or"]),
    conditions: z.array(z.union([ZWorkflowCondition, z.lazy(() => ZWorkflowConditionGroup)])).min(1),
  })
);

export const ZIfElseNode = z.object({
  id: z.string().min(1),
  type: z.literal("ifElse"),
  config: z.object({
    condition: ZWorkflowConditionGroup,
  }),
});
```

## Action Nodes

```ts
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

export const ZWorkflowActionNode = z.discriminatedUnion("actionType", [
  z.object({
    id: z.string().min(1),
    type: z.literal("action"),
    actionType: z.literal("sendEmailPreview"),
    config: ZSendEmailPreviewActionConfig,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("action"),
    actionType: z.literal("sendWebhookPreview"),
    config: ZSendWebhookPreviewActionConfig,
  }),
]);
```

Do not accept `compute` in `ZWorkflowDefinition` for the PoC. If the UI needs to show future action options, keep
them disabled or outside the persisted workflow schema.

## Deferred Beta Action Sketch

Keep this shape visible for the later MVP/Beta plan, but do not include it in the PoC action union:

```ts
export const ZComputeActionConfig = z.object({
  expression: z.string().min(1),
  outputKey: z.string().min(1),
});

export const ZComputeActionNode = z.object({
  id: z.string().min(1),
  type: z.literal("action"),
  actionType: z.literal("compute"),
  config: ZComputeActionConfig,
});
```

## Edges

```ts
export const ZWorkflowEdge = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  branch: z.enum(["then", "else", "next"]).default("next"),
});
```

For If/Else nodes, use `then` and `else`. For trigger/action sequencing, use `next`.

## Run and Step Output Shape

```ts
export const ZWorkflowStepResult = z.object({
  nodeId: z.string().min(1),
  status: z.enum(["completed", "failed", "skipped"]),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
});

export const ZWorkflowRunData = z.object({
  triggerPayload: z.unknown(),
  steps: z.array(ZWorkflowStepResult).default([]),
  finalOutput: z.unknown().optional(),
  logs: z
    .array(
      z.object({
        level: z.enum(["info", "warn", "error"]),
        message: z.string(),
        timestamp: z.string().datetime(),
        nodeId: z.string().optional(),
      })
    )
    .default([]),
});
```

Structured logs are Beta-leaning; the PoC can persist `steps`, `finalOutput`, timestamps, and one failure
message on the run row.

## Deferred Dry-Run Shape

Keep this schema sketched but do not implement the endpoint/UI in the PoC:

```ts
export const ZWorkflowDryRunRequest = z.object({
  workflowId: z.cuid2().optional(),
  definition: ZWorkflowDefinition.optional(),
  triggerPayload: z.unknown(),
});

export const ZWorkflowDryRunResponse = z.object({
  status: z.enum(["completed", "failed"]),
  steps: z.array(ZWorkflowStepResult),
  finalOutput: z.unknown().optional(),
  error: z.string().optional(),
});
```

## Prototype Mapping

- Keep: zod-first contract, data refs, trigger output registry, descriptor-driven actions, path-based issues.
- Keep lifecycle status `enabled`; rename `survey.response.created` -> `response.completed`.
- Reject for PoC: Slack action, user-authored body templating, AI generation path, copying Jotai state as data.
- Adapt: use `@formbricks/types` conventions, `z.cuid2()` IDs where they reference persisted Formbricks records,
  and Formbricks run/lifecycle vocabularies exactly.
