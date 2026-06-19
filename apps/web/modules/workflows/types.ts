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
