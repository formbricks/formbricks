# Research: Workflows Data and Jobs Sketch

| Field      | Value                                                                      |
| ---------- | -------------------------------------------------------------------------- |
| Status     | Done                                                                       |
| Date       | 2026-05-22                                                                 |
| Source     | [001-000](../../cowork/plans/001-000-prototype-readiness-and-contracts.md) |
| Next input | [001-010](../../cowork/plans/001-010-workflows-poc-vertical-slice.md)      |

## Existing Persistence Patterns

- Prisma schema uses `createdAt`/`updatedAt` with DB column maps `created_at`/`updated_at`.
- Workspace-owned models relate to `Workspace` with `onDelete: Cascade`.
- JSONB-backed config fields use Prisma `Json` with comments that point to generated JSON types.
- Recent workspace-scoped models use indexes such as `[workspaceId, createdAt]`, `[workspaceId, updatedAt]`,
  and unique `[workspaceId, name]` where names should be scoped.
- Composite workspace/resource uniqueness exists where cross-resource FKs need workspace safety, for example
  `Survey` has `@@unique([id, workspaceId])`.

## Prisma Model Sketch

```prisma
enum WorkflowStatus {
  draft
  enabled
  disabled
}

enum WorkflowRunStatus {
  queued
  running
  completed
  failed
  canceled
}

model Workflow {
  id          String        @id @default(cuid())
  createdAt   DateTime      @default(now()) @map(name: "created_at")
  updatedAt   DateTime      @updatedAt @map(name: "updated_at")
  name        String
  status      WorkflowStatus @default(draft)
  workspace   Workspace      @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  workspaceId String
  creator     User?          @relation(fields: [createdBy], references: [id], onDelete: SetNull)
  createdBy   String?
  /// [WorkflowDefinition]
  definition  Json           @default("{}")
  runs        WorkflowRun[]

  @@unique([workspaceId, name])
  @@unique([id, workspaceId])
  @@index([workspaceId, status])
  @@index([workspaceId, updatedAt])
}

model WorkflowRun {
  id             String            @id @default(cuid())
  createdAt      DateTime          @default(now()) @map(name: "created_at")
  updatedAt      DateTime          @updatedAt @map(name: "updated_at")
  workflow       Workflow          @relation(fields: [workflowId, workspaceId], references: [id, workspaceId], onDelete: Cascade)
  workflowId     String
  workspace      Workspace         @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  workspaceId    String
  status         WorkflowRunStatus @default(queued)
  triggerEvent   String            @map(name: "trigger_event")
  surveyId       String?
  responseId     String?
  /// [WorkflowTriggerPayload]
  triggerPayload Json              @default("{}") @map(name: "trigger_payload")
  /// [WorkflowRunData]
  data           Json              @default("{}")
  error          String?
  startedAt      DateTime?         @map(name: "started_at")
  finishedAt     DateTime?         @map(name: "finished_at")

  @@index([workspaceId, createdAt])
  @@index([workflowId, workspaceId, createdAt])
  @@index([status, createdAt])
  @@index([responseId])
}
```

Add `workflows Workflow[]` and `workflowRuns WorkflowRun[]` relations to `Workspace`. Add a named relation to
`User` if `createdBy` is included, following the `Chart`/`Dashboard` creator pattern.

## PoC Persistence Notes

- Store only the current workflow definition. Version snapshots are Beta.
- Do not add audit-log tables in the PoC.
- Do not add retention pruning in the PoC. Retention policy is Beta.
- Workspace scoping must be enforced in every workflow/run query, even if the demo uses one workspace.
- `WorkflowRun.workflow` should use the composite `[workflowId, workspaceId]` relation against
  `Workflow.[id, workspaceId]` so a run cannot point at a workflow from another workspace.
- If hard delete is implemented for PoC, cascade deleting runs is acceptable. If product review prefers history
  retention, replace hard delete with a Beta archive/soft-delete decision before coding deletion.
- Do not store React Flow as a separate source of truth. Optional node `ui` metadata can store layout positions.

## Existing Jobs Patterns

- Shared jobs package: `packages/jobs`.
- Queue name: `background-jobs`.
- Prefix: `{formbricks:jobs}`.
- Job names are centralized in `JOB_NAMES`.
- Job schemas live in `packages/jobs/src/types.ts`.
- Job definitions live in `packages/jobs/src/definitions.ts`.
- App-specific handler overrides are registered in `apps/web/instrumentation-jobs.ts`.
- Current response pipeline job name is `response-pipeline.process`.
- Runtime default concurrency is `1`; worker count default is `1`.
- Default job options currently include `attempts: 3`, which conflicts with the PoC no-retry shortcut for workflow
  execution unless workflow jobs override attempts.

## Workflow Job Contract

Add a job name:

```ts
JOB_NAMES.workflowRun = "workflow-run.process";
```

Add browser/server-safe job data schema in `packages/jobs/src/types.ts`:

```ts
export const ZWorkflowRunJobData = z.object({
  workflowRunId: z.cuid2(),
  workflowId: z.cuid2(),
  workspaceId: z.cuid2(),
});
```

Add producer:

```ts
enqueueWorkflowRunJob(data: TWorkflowRunJobData)
```

PoC-specific queue options:

- Attempts: `1`.
- Backoff: none.
- Concurrency: existing runtime default `1` is acceptable.
- Worker count: existing runtime default `1` is acceptable.
- No batching/backpressure decisions.

If the current `enqueueBackgroundJob` abstraction does not expose per-job options cleanly, update it in 001-010
so workflow jobs can set `attempts: 1`. Do not silently inherit the package default of three attempts for the
PoC workflow worker.

## Processor Location

- Shared package fallback processor:
  - `packages/jobs/src/processors/workflow-run.ts`
  - Same shape as `processors/response-pipeline.ts`: log and throw if no app override is registered.
- App implementation:
  - `apps/web/modules/workflows/lib/process-workflow-run-job.ts`
- Runtime override registration:
  - `apps/web/instrumentation-jobs.ts`
  - Add `[WORKFLOW_RUN_JOB_NAME]: workflowRunJobHandler`.

## Trigger Matcher Contract

The response-completed matcher should:

1. Receive `workspaceId`, `surveyId`, and the existing response pipeline response payload.
2. Find `enabled` workflows in the same workspace whose trigger type is `response.completed`.
3. Filter by trigger `surveyId` when configured.
4. Create one `WorkflowRun` row per matching workflow with `status=queued`.
5. Enqueue one `workflow-run.process` BullMQ job per created run.
6. Log failures without sending email/webhook side effects.

## Run Data Contract

For the PoC, persist enough detail for run list/detail:

- Run row:
  - `status`, `createdAt`, `updatedAt`, `startedAt`, `finishedAt`, `error`.
  - `workflowId`, `workspaceId`, `surveyId`, `responseId`.
  - Load/update by `id`, `workflowId`, and `workspaceId`; do not trust `workflowId` alone.
- Run `data` JSON:
  - `steps`: array of node-level input/output/status records.
  - `finalOutput`.
- Trigger payload JSON:
  - Existing response pipeline response payload plus `surveyId` and `workspaceId`.

## Execution Contract

The worker:

- Moves `queued` -> `running` before graph execution.
- Starts from the trigger node and follows `next`, `then`, or `else` edges.
- Evaluates If/Else against the trigger payload or prior step output.
- Produces preview outputs for Send Email and Send Webhook without side effects.
- Moves to `completed` with step outputs when the selected path finishes.
- Moves to `failed` with one failure message if validation, graph traversal, or an action preview fails.
