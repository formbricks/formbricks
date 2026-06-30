// Run shapes the UI consumes, re-exported from the workflows contract package so components import
// them from one module. The list endpoint returns the slim summary plus the joined workflow name
// (TWorkflowRunListItem); the detail endpoint returns the full resource with step logs, trigger
// payload, and run data (TWorkflowRunDetail).
export type {
  TWorkflowRunListItem,
  TWorkflowRunResource as TWorkflowRunDetail,
  TWorkflowRunSummary,
} from "@formbricks/workflows";
