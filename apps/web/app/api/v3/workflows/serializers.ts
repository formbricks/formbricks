import type { Workflow, WorkflowRun } from "@prisma/client";
import { ZWorkflowDefinition, ZWorkflowRunData } from "@formbricks/types/workflows";

const serializeWorkflowRunSummary = (run: WorkflowRun) => ({
  id: run.id,
  workflowId: run.workflowId,
  workspaceId: run.workspaceId,
  status: run.status,
  triggerEvent: run.triggerEvent,
  surveyId: run.surveyId,
  responseId: run.responseId,
  error: run.error,
  createdAt: run.createdAt,
  updatedAt: run.updatedAt,
  startedAt: run.startedAt,
  finishedAt: run.finishedAt,
});

export const serializeWorkflow = (workflow: Workflow & { runs?: WorkflowRun[] }) => ({
  id: workflow.id,
  name: workflow.name,
  description: workflow.description,
  status: workflow.status,
  workspaceId: workflow.workspaceId,
  createdBy: workflow.createdBy,
  definition: ZWorkflowDefinition.parse(workflow.definition),
  createdAt: workflow.createdAt,
  updatedAt: workflow.updatedAt,
  lastRun: workflow.runs?.[0] ? serializeWorkflowRunSummary(workflow.runs[0]) : null,
});

export const serializeWorkflowRun = (run: WorkflowRun) => ({
  ...serializeWorkflowRunSummary(run),
  triggerPayload: run.triggerPayload,
  data: ZWorkflowRunData.parse(run.data),
});

export const serializeWorkflowRunWithWorkflow = (run: WorkflowRun & { workflow: Workflow }) => ({
  ...serializeWorkflowRun(run),
  workflow: {
    id: run.workflow.id,
    name: run.workflow.name,
  },
});
