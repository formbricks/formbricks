import type {
  TWorkflowListItem,
  TWorkflowResource,
  TWorkflowRunListItem,
  TWorkflowRunLogResource,
  TWorkflowRunResource,
  TWorkflowRunSummary,
} from "../contracts";
import type {
  WorkflowRowWithLastRun,
  WorkflowRunListRow,
  WorkflowRunLogRow,
  WorkflowRunRow,
  WorkflowRunWithLogsRow,
} from "../services/ports";

/**
 * Map Prisma rows to the public v3 resource shapes. Serializer output is validated against the
 * Zod resource schemas at the handler boundary, so these functions stay simple: ISO date strings,
 * explicit nulls, and derived `triggerType` / `surveyId` read from the (already-validated, typed)
 * definition JSON. The definition is intentionally NOT re-parsed here.
 */

const toIso = (date: Date | null): string | null => (date ? date.toISOString() : null);

export const toWorkflowRunSummary = (run: WorkflowRunRow): TWorkflowRunSummary => ({
  id: run.id,
  workflowId: run.workflowId,
  workspaceId: run.workspaceId,
  workflowVersionId: run.workflowVersionId,
  status: run.status,
  isDryRun: run.isDryRun,
  // `triggerType` is a `String` column (see WorkflowRunRow in ports.ts); the union is enforced by
  // `validateOutput(ZWorkflowRunSummary, …)` at the handler boundary, so this narrowing cast is safe.
  triggerType: run.triggerType as TWorkflowRunSummary["triggerType"],
  surveyId: run.surveyId,
  responseId: run.responseId,
  error: run.error,
  attempt: run.attempt,
  createdAt: run.createdAt.toISOString(),
  updatedAt: run.updatedAt.toISOString(),
  startedAt: toIso(run.startedAt),
  finishedAt: toIso(run.finishedAt),
});

export const toWorkflowRunListItem = (run: WorkflowRunListRow): TWorkflowRunListItem => ({
  ...toWorkflowRunSummary(run),
  workflowName: run.workflow.name,
});

export const toWorkflowRunLogResource = (log: WorkflowRunLogRow): TWorkflowRunLogResource => ({
  id: log.id,
  runId: log.runId,
  sequence: log.sequence,
  stepId: log.stepId,
  stepType: log.stepType,
  status: log.status,
  input: log.input,
  output: log.output,
  error: log.error,
  startedAt: toIso(log.startedAt),
  finishedAt: toIso(log.finishedAt),
});

export const toWorkflowRunResource = (run: WorkflowRunWithLogsRow): TWorkflowRunResource => ({
  ...toWorkflowRunSummary(run),
  triggerPayload: run.triggerPayload,
  data: run.data,
  logs: run.logs.map(toWorkflowRunLogResource),
  idempotencyKey: run.idempotencyKey,
  nextAttemptAt: toIso(run.nextAttemptAt),
  lastErrorAt: toIso(run.lastErrorAt),
});

export const toWorkflowListItem = (row: WorkflowRowWithLastRun): TWorkflowListItem => {
  const { trigger } = row.definition;

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description,
    status: row.status,
    triggerType: trigger.triggerType,
    surveyId: trigger.config.surveyId,
    createdBy: row.createdBy,
    creator: row.creator ? { name: row.creator.name } : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastRun: row.runs[0] ? toWorkflowRunSummary(row.runs[0]) : null,
    runCount: row._count.runs,
  };
};

export const toWorkflowResource = (row: WorkflowRowWithLastRun): TWorkflowResource => ({
  ...toWorkflowListItem(row),
  definition: row.definition,
});
