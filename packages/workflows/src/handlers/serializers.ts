import type { TWorkflowListItem, TWorkflowResource, TWorkflowRunSummary } from "../contracts";
import type { WorkflowRowWithLastRun, WorkflowRunRow } from "../services/ports";

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
  };
};

export const toWorkflowResource = (row: WorkflowRowWithLastRun): TWorkflowResource => ({
  ...toWorkflowListItem(row),
  definition: row.definition,
});
