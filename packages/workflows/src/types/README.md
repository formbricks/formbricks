# Workflow Types And Data Model

This folder defines the public workflow contracts for `@formbricks/workflows`. The schemas are Zod
validators, and the exported TypeScript types are inferred from them. The main idea is simple:

- A workflow has one trigger.
- Work after the trigger is represented as child nodes.
- Edges connect nodes into a graph.
- Runtime payloads and run logs capture what happened when a trigger fired.

The package keeps these contracts framework-independent. App-specific code can store, render, and execute the
objects, but the object shapes live here.

## Core Ideas

`ZWorkflowDefinition` is the persisted graph. It can include builder-only concepts such as future conditional
nodes. `ZWorkflowExecutableDefinition` is the subset the current workflow runner can execute. It uses the same
object shape but is stricter: every node must be reachable from the trigger, the graph must be acyclic, and
`if_else` nodes are rejected for now.

`config` means user-authored setup for a trigger or action. Runtime data does not belong in `config`; it
belongs in trigger payloads, run data, or run logs.

`ui` means builder-only metadata. It can help render the workflow builder, but it must not change execution.

## Shared Objects

### `ZWorkflowNodePosition` / `TWorkflowNodePosition`

Position of a node in the workflow builder canvas.

Properties:

- `x`: Horizontal canvas coordinate.
- `y`: Vertical canvas coordinate.

Example:

```json
{
  "x": 320,
  "y": 0
}
```

### `ZWorkflowNodeUi` / `TWorkflowNodeUi`

Optional metadata used by the workflow builder UI. The runner should ignore this object. Unknown extra keys are
allowed so the builder can add display metadata without changing execution contracts.

Properties:

- `position`: Optional `ZWorkflowNodePosition`.
- `collapsed`: Optional flag for whether the node should render collapsed in the builder.
- extra keys: Optional builder-only metadata, such as colors or view preferences.

Example:

```json
{
  "collapsed": false,
  "color": "blue",
  "position": {
    "x": 0,
    "y": 0
  }
}
```

### `ZWorkflowDataRef` / `TWorkflowDataRef`

A reference to data available during a workflow run. It uses a dot path instead of copying the value into the
workflow definition.

Properties:

- `path`: Dot path to a value in the run context.
- `fallback`: Optional string to use if the path cannot be resolved.

Example:

```json
{
  "fallback": "support@example.com",
  "path": "response.email"
}
```

### `ZWorkflowNodeBase`

The fields shared by all workflow nodes. Concrete nodes extend this with trigger-specific, action-specific, or
condition-specific fields.

Properties:

- `id`: Stable node id inside the workflow definition. Edges use this value.
- `type`: Node kind. Current values are `trigger`, `action`, and `if_else`.
- `label`: Optional human-readable node label.
- `ui`: Optional builder-only metadata.

Example:

```json
{
  "id": "send-email",
  "label": "Send thank you email",
  "type": "action",
  "ui": {
    "collapsed": false,
    "position": {
      "x": 320,
      "y": 0
    }
  }
}
```

## Workflow Graph Objects

### `ZWorkflowEdge` / `TWorkflowEdge`

Connection between two workflow nodes.

Properties:

- `id`: Stable edge id inside the workflow definition.
- `source`: Node id where the edge starts.
- `target`: Node id where the edge ends.
- `sourceHandle`: Optional source-side handle. `if_else` source edges must use `then` or `else`.
- `targetHandle`: Optional target-side handle, useful for builder UI and future node types.

Example:

```json
{
  "id": "trigger-send-email",
  "source": "trigger",
  "target": "send-email",
  "targetHandle": "input"
}
```

### `ZWorkflowDefinitionBase` / `TWorkflowDefinitionBase`

Base persisted workflow graph shape. Both `ZWorkflowDefinition` and `ZWorkflowExecutableDefinition` validate
this shape with different rules.

Properties:

- `schemaVersion`: Workflow document schema version. Defaults to `1`.
- `trigger`: The one trigger node for the workflow.
- `nodes`: Child nodes that run after the trigger. These are action or condition nodes, not trigger nodes.
- `edges`: Connections between the trigger and child nodes.
- `entryNodeId`: Workflow entry point. It must reference the trigger node id.

Example:

```json
{
  "edges": [
    {
      "id": "trigger-send-email",
      "source": "trigger",
      "target": "send-email"
    }
  ],
  "entryNodeId": "trigger",
  "nodes": [
    {
      "actionType": "send_email",
      "config": {
        "attachResponseData": true,
        "body": "We received your response.",
        "from": "noreply@example.com",
        "includeHiddenFields": false,
        "includeVariables": false,
        "replyTo": ["support@example.com"],
        "subject": "Thanks for your response",
        "to": "{{response.email}}"
      },
      "id": "send-email",
      "type": "action"
    }
  ],
  "schemaVersion": 1,
  "trigger": {
    "config": {
      "endingCardIds": [],
      "surveyId": "cm9zr4mps000008l8btfy1vtz"
    },
    "id": "trigger",
    "triggerType": "response.completed",
    "type": "trigger"
  }
}
```

### `ZWorkflowDefinition` / `TWorkflowDefinition`

Persisted workflow definition with graph validation. It rejects duplicate node ids, invalid edge references,
wrong `if_else` branch handles, and definitions where the trigger has more than one outgoing edge (a
trigger-only draft with no nodes or edges is valid; only the executable definition requires the edge).

It uses the same object shape as `ZWorkflowDefinitionBase`.

Example:

```json
{
  "edges": [
    {
      "id": "trigger-send-email",
      "source": "trigger",
      "target": "send-email"
    }
  ],
  "entryNodeId": "trigger",
  "nodes": [
    {
      "actionType": "send_email",
      "config": {
        "attachResponseData": false,
        "body": "Thanks for your response.",
        "from": "noreply@example.com",
        "replyTo": ["support@example.com"],
        "subject": "Thanks",
        "to": "{{response.email}}"
      },
      "id": "send-email",
      "type": "action"
    }
  ],
  "schemaVersion": 1,
  "trigger": {
    "config": {
      "endingCardIds": ["cm9zr4q7i000108l84gozfggr"],
      "surveyId": "cm9zr4mps000008l8btfy1vtz"
    },
    "id": "trigger",
    "triggerType": "response.completed",
    "type": "trigger"
  }
}
```

### `ZWorkflowExecutableDefinition` / `TWorkflowExecutableDefinition`

Workflow definition snapshot that the current workflow runner can execute. It uses the same fields as
`ZWorkflowDefinitionBase`, but it is intentionally stricter.

Rules:

- Every edge must point to known nodes.
- `entryNodeId` must equal the trigger id.
- The trigger must have exactly one outgoing edge.
- Every child node must be reachable from the trigger.
- The executable graph must not contain cycles.
- `if_else` nodes are rejected in current executable definitions.

Example:

```json
{
  "edges": [
    {
      "id": "trigger-send-email",
      "source": "trigger",
      "target": "send-email"
    }
  ],
  "entryNodeId": "trigger",
  "nodes": [
    {
      "actionType": "send_email",
      "config": {
        "attachResponseData": false,
        "body": "Thanks for your response.",
        "from": "noreply@example.com",
        "replyTo": ["support@example.com"],
        "subject": "Thanks",
        "to": "jane@example.com"
      },
      "id": "send-email",
      "type": "action"
    }
  ],
  "schemaVersion": 1,
  "trigger": {
    "config": {
      "endingCardIds": [],
      "surveyId": "cm9zr4mps000008l8btfy1vtz"
    },
    "id": "trigger",
    "triggerType": "response.completed",
    "type": "trigger"
  }
}
```

## Trigger Objects

### `ZResponseCompletedTriggerConfig` / `TResponseCompletedTriggerConfig`

Configuration for the `response.completed` trigger. This is authored when the workflow is configured.

Properties:

- `surveyId`: Survey whose completed responses can trigger the workflow.
- `endingCardIds`: Ending card ids that should trigger the workflow. An empty array means all endings.

Example:

```json
{
  "endingCardIds": ["cm9zr4q7i000108l84gozfggr"],
  "surveyId": "cm9zr4mps000008l8btfy1vtz"
}
```

### `ZWorkflowResponseCompletedTriggerNode` / `TWorkflowResponseCompletedTriggerNode`

Trigger node for survey response completion.

Properties:

- `id`: Node id, usually `trigger`.
- `type`: Always `trigger`.
- `triggerType`: Always `response.completed`.
- `label`: Optional builder label.
- `ui`: Optional builder-only metadata.
- `config`: `ZResponseCompletedTriggerConfig`.

Example:

```json
{
  "config": {
    "endingCardIds": [],
    "surveyId": "cm9zr4mps000008l8btfy1vtz"
  },
  "id": "trigger",
  "label": "Survey response completed",
  "triggerType": "response.completed",
  "type": "trigger",
  "ui": {
    "position": {
      "x": 0,
      "y": 0
    }
  }
}
```

### `ZWorkflowTriggerPayload` / `TWorkflowTriggerPayload`

Runtime payload captured when a `response.completed` trigger fires. This is not user-authored config; it is
the event context the runner needs.

Properties:

- `type`: Always `response.completed`.
- `workspaceId`: Workspace/tenant context for the run.
- `surveyId`: Survey that received the response.
- `responseId`: Completed response that caused the trigger.
- `endingCardId`: Optional ending card reached by the response.
- `data`: Optional trigger data available to actions and conditions, such as response fields.
- extra keys: Optional future runtime metadata.

Example:

```json
{
  "data": {
    "response": {
      "email": "jane@example.com",
      "score": 9
    }
  },
  "endingCardId": "cm9zr4q7i000108l84gozfggr",
  "responseId": "cm9zr4rsp000708l8bqccpfrx",
  "surveyId": "cm9zr4mps000008l8btfy1vtz",
  "type": "response.completed",
  "workspaceId": "cm9zr4wsp000508l8y6nh9r2v"
}
```

## Action Objects

### `ZWorkflowSendEmailActionConfig` / `TWorkflowSendEmailActionConfig`

Configuration for the `send_email` action.

Properties:

- `to`: Recipient expression. It can be a direct email string or a dynamic value resolved by the runner.
- `from`: Sender email address.
- `replyTo`: Email addresses used when the recipient replies.
- `subject`: Email subject.
- `body`: Email body.
- `attachResponseData`: Whether to include response data in the email.
- `includeVariables`: Optional flag for including survey variables when response data is attached.
- `includeHiddenFields`: Optional flag for including hidden fields when response data is attached.

Example:

```json
{
  "attachResponseData": true,
  "body": "We received your response.",
  "from": "noreply@example.com",
  "includeHiddenFields": false,
  "includeVariables": false,
  "replyTo": ["support@example.com"],
  "subject": "Thanks for your response",
  "to": "{{response.email}}"
}
```

### `ZWorkflowSendEmailActionNode` / `TWorkflowSendEmailActionNode`

Action node that sends an email.

Properties:

- `id`: Node id used by edges and logs.
- `type`: Always `action`.
- `actionType`: Always `send_email`.
- `label`: Optional builder label.
- `ui`: Optional builder-only metadata.
- `config`: `ZWorkflowSendEmailActionConfig`.

Example:

```json
{
  "actionType": "send_email",
  "config": {
    "attachResponseData": false,
    "body": "Thanks for your response.",
    "from": "noreply@example.com",
    "replyTo": ["support@example.com"],
    "subject": "Thanks",
    "to": "{{response.email}}"
  },
  "id": "send-email",
  "label": "Send thank you email",
  "type": "action",
  "ui": {
    "position": {
      "x": 320,
      "y": 0
    }
  }
}
```

## Condition Objects

### `ZWorkflowCondition` / `TWorkflowCondition`

One boolean check inside a condition group.

Properties:

- `id`: Stable condition id.
- `left`: `ZWorkflowDataRef` for the value being checked.
- `operator`: Comparison operator. Current values are `equals`, `notEquals`, `lessThan`, `lessEqual`,
  `greaterThan`, `greaterEqual`, `contains`, `notContains`, `exists`, and `notExists`.
- `right`: Right-hand comparison value. Presence operators `exists` and `notExists` must omit it. All other
  operators require it.

Example:

```json
{
  "id": "score-high",
  "left": {
    "path": "response.score"
  },
  "operator": "greaterThan",
  "right": 8
}
```

### `ZWorkflowConditionGroup` / `TWorkflowConditionGroup`

A group of conditions combined with `and` or `or`. Groups can contain other groups, which allows nested logic.

Properties:

- `id`: Stable group id.
- `connector`: `and` means all children must pass. `or` means at least one child must pass.
- `conditions`: Non-empty list of `ZWorkflowCondition` or nested `ZWorkflowConditionGroup` objects.

Example:

```json
{
  "conditions": [
    {
      "id": "email-exists",
      "left": {
        "path": "response.email"
      },
      "operator": "exists"
    },
    {
      "id": "score-high",
      "left": {
        "path": "response.score"
      },
      "operator": "greaterThan",
      "right": 8
    }
  ],
  "connector": "and",
  "id": "qualified-response"
}
```

### `ZWorkflowIfElseNode` / `TWorkflowIfElseNode`

Branching node for conditional logic. It is valid in generic workflow definitions, but not executable by the
current workflow runner.

Properties:

- `id`: Node id used by edges.
- `type`: Always `if_else`.
- `label`: Optional builder label.
- `ui`: Optional builder-only metadata.
- `config.condition`: `ZWorkflowConditionGroup` evaluated by the branch.

Edge rules:

- One outgoing edge must use `sourceHandle: "then"`.
- One outgoing edge must use `sourceHandle: "else"`.

Example:

```json
{
  "config": {
    "condition": {
      "conditions": [
        {
          "id": "score-high",
          "left": {
            "path": "response.score"
          },
          "operator": "greaterThan",
          "right": 8
        }
      ],
      "connector": "and",
      "id": "qualified-response"
    }
  },
  "id": "condition",
  "label": "Qualified response",
  "type": "if_else",
  "ui": {
    "collapsed": true
  }
}
```

## Run And Version Objects

### `ZWorkflowTriggerRunPayload` / `TWorkflowTriggerRunPayload`

Trigger payload snapshot stored with a workflow run. It extends `ZWorkflowTriggerPayload` with the time the
workflow was triggered.

Properties:

- All properties from `ZWorkflowTriggerPayload`.
- `triggeredAt`: ISO datetime string for when the workflow trigger was captured.

Example:

```json
{
  "data": {
    "response": {
      "email": "jane@example.com"
    }
  },
  "endingCardId": "cm9zr4q7i000108l84gozfggr",
  "responseId": "cm9zr4rsp000708l8bqccpfrx",
  "surveyId": "cm9zr4mps000008l8btfy1vtz",
  "triggeredAt": "2026-06-09T12:01:00.000Z",
  "type": "response.completed",
  "workspaceId": "cm9zr4wsp000508l8y6nh9r2v"
}
```

### `ZWorkflowRunLogInput` / `TWorkflowRunLogInput`

Arbitrary input object captured for a workflow step. The shape depends on the step type.

Properties:

- extra keys: Step input values.

Example:

```json
{
  "subject": "Thanks",
  "to": "jane@example.com"
}
```

### `ZWorkflowRunLogOutput` / `TWorkflowRunLogOutput`

Arbitrary output object captured for a workflow step. The shape depends on the step type and provider.

Properties:

- extra keys: Step output values.

Example:

```json
{
  "messageId": "message-1",
  "provider": "smtp"
}
```

### `ZWorkflowStepResult` / `TWorkflowStepResult`

In-memory or serialized result for one executed step in a run.

Properties:

- `stepId`: Node id for the executed step.
- `stepType`: Step type, such as `send_email`.
- `status`: Step status. Current values are `pending`, `running`, `succeeded`, `failed`, and `skipped`.
- `input`: Optional object with the step input.
- `output`: Optional object with the step output.
- `error`: Optional error message.
- `startedAt`: Optional ISO datetime string for when the step started.
- `finishedAt`: Optional ISO datetime string for when the step finished.

Example:

```json
{
  "error": "SMTP provider rejected the message",
  "finishedAt": "2026-06-09T12:01:03.000Z",
  "input": {
    "subject": "Thanks",
    "to": "jane@example.com"
  },
  "output": {
    "provider": "smtp"
  },
  "startedAt": "2026-06-09T12:01:01.000Z",
  "status": "failed",
  "stepId": "send-email",
  "stepType": "send_email"
}
```

### `ZWorkflowRunData` / `TWorkflowRunData`

Run-level data snapshot. This is useful for storing the trigger payload and step results together. Unknown
extra keys are allowed for future run metadata such as retry attempt.

Properties:

- `trigger`: Optional `ZWorkflowTriggerRunPayload`.
- `steps`: List of `ZWorkflowStepResult` objects. Defaults to an empty array.
- extra keys: Optional run metadata.

Example:

```json
{
  "attempt": 1,
  "steps": [
    {
      "status": "succeeded",
      "stepId": "send-email",
      "stepType": "send_email"
    }
  ],
  "trigger": {
    "responseId": "cm9zr4rsp000708l8bqccpfrx",
    "surveyId": "cm9zr4mps000008l8btfy1vtz",
    "triggeredAt": "2026-06-09T12:01:00.000Z",
    "type": "response.completed",
    "workspaceId": "cm9zr4wsp000508l8y6nh9r2v"
  }
}
```

### `ZWorkflowVersion` / `TWorkflowVersion`

Immutable published workflow definition used by runs.

Properties:

- `id`: Workflow version id.
- `workflowId`: Workflow id this version belongs to.
- `workspaceId`: Workspace/tenant id.
- `version`: Positive monotonic version number.
- `definition`: `ZWorkflowExecutableDefinition` snapshot.
- `publishedAt`: ISO datetime string for publication time.
- `publishedBy`: Optional user id that published this version. It may be `null`.

Example:

```json
{
  "definition": {
    "edges": [
      {
        "id": "trigger-send-email",
        "source": "trigger",
        "target": "send-email"
      }
    ],
    "entryNodeId": "trigger",
    "nodes": [
      {
        "actionType": "send_email",
        "config": {
          "attachResponseData": false,
          "body": "Thanks for your response.",
          "from": "noreply@example.com",
          "replyTo": ["support@example.com"],
          "subject": "Thanks",
          "to": "{{response.email}}"
        },
        "id": "send-email",
        "type": "action"
      }
    ],
    "schemaVersion": 1,
    "trigger": {
      "config": {
        "endingCardIds": [],
        "surveyId": "cm9zr4mps000008l8btfy1vtz"
      },
      "id": "trigger",
      "triggerType": "response.completed",
      "type": "trigger"
    }
  },
  "id": "cm9zr4ver000308l8h4hn6f5x",
  "publishedAt": "2026-06-09T12:00:00.000Z",
  "publishedBy": "cm9zr4usr000608l8ly1pkz8r",
  "version": 1,
  "workflowId": "cm9zr4wrk000408l8tmq2r7ua",
  "workspaceId": "cm9zr4wsp000508l8y6nh9r2v"
}
```

### `ZWorkflowRunLog` / `TWorkflowRunLog`

Persisted trace entry for one workflow run step.

Properties:

- `id`: Run log row id.
- `runId`: Workflow run id.
- `sequence`: Zero-based or monotonic sequence number for ordering logs.
- `stepId`: Node id for the step.
- `stepType`: Step type, such as `send_email`.
- `status`: Log status. Current values are `pending`, `running`, `succeeded`, `failed`, and `skipped`.
- `input`: Optional object with the persisted step input.
- `output`: Optional object with the persisted step output.
- `error`: Optional error message. It may be `null`.
- `startedAt`: Optional ISO datetime string. It may be `null`.
- `finishedAt`: Optional ISO datetime string. It may be `null`.

Example:

```json
{
  "error": "SMTP provider rejected the message",
  "finishedAt": "2026-06-09T12:01:03.000Z",
  "id": "cm9zr4log000808l8f36vw9sz",
  "input": {
    "subject": "Thanks",
    "to": "jane@example.com"
  },
  "output": {
    "provider": "smtp"
  },
  "runId": "cm9zr4run000908l8q9b9d3pm",
  "sequence": 1,
  "startedAt": "2026-06-09T12:01:01.000Z",
  "status": "failed",
  "stepId": "send-email",
  "stepType": "send_email"
}
```

## Status Values

`ZWorkflowStatus` / `TWorkflowStatus` describes the workflow lifecycle:

- `draft`: Editable workflow that is not active.
- `enabled`: Active workflow.
- `disabled`: Inactive workflow that is still available.
- `archived`: Soft-deleted workflow excluded from normal reads.

`ZWorkflowRunStatus` / `TWorkflowRunStatus` describes a full workflow run:

- `queued`: Waiting to start.
- `running`: Currently executing.
- `completed`: Finished successfully.
- `failed`: Finished with an error.
- `canceled`: Stopped before completion.

`ZWorkflowRunLogStatus` / `TWorkflowRunLogStatus` describes one step:

- `pending`: Step has not started.
- `running`: Step is executing.
- `succeeded`: Step completed successfully.
- `failed`: Step errored.
- `skipped`: Step was intentionally skipped.
