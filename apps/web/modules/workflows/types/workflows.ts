import type {
  TWorkflowDefinition,
  TWorkflowRunData,
  TWorkflowRunStatus,
  TWorkflowStatus,
} from "@formbricks/types/workflows";

export type TWorkflowRunSummary = {
  id: string;
  workflowId: string;
  workspaceId: string;
  status: TWorkflowRunStatus;
  triggerEvent: string;
  surveyId: string | null;
  responseId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type TWorkflowRunWorkflowSummary = {
  id: string;
  name: string;
};

export type TWorkflowRun = TWorkflowRunSummary & {
  triggerPayload: unknown;
  data: TWorkflowRunData;
  workflow?: TWorkflowRunWorkflowSummary;
};

export type TWorkflow = {
  id: string;
  name: string;
  description: string | null;
  status: TWorkflowStatus;
  workspaceId: string;
  createdBy: string | null;
  definition: TWorkflowDefinition;
  createdAt: string;
  updatedAt: string;
  lastRun: TWorkflowRunSummary | null;
};
