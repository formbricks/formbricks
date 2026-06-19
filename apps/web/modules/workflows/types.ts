import type { TWorkflowRunResource } from "@formbricks/workflows";

// Run resource enriched with the resolved workflow name. The join happens in the
// route (the run resource itself only carries workflowId), so components receive
// a display-ready item without reaching into the data layer.
export type TWorkflowRunListItem = TWorkflowRunResource & { workflowName: string };

export interface TWorkflowOperationalSettings {
  capRunsEnabled: boolean;
  capRunsLimit: string;
  capRunsUnit: "hour" | "day" | "week";
  aiOverview?: string;
}

export interface TWorkflowHistoryRow {
  id: string;
  date: string;
  status: "success" | "fail";
}

export interface TWorkflowHistorySummary {
  totalRuns: string;
  failed: string;
  avgRunTime: string;
  rows: TWorkflowHistoryRow[];
}
