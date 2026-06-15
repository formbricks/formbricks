type TWorkflowStatus = "draft" | "inProgress" | "paused";
type TBadgeType = "error" | "gray" | "success" | "warning";

export const placeholderUnavailableLabel = "Not set";

export const placeholderWorkflows = [
  {
    activityLabel: placeholderUnavailableLabel,
    createdAtLabel: placeholderUnavailableLabel,
    id: "response-completed-follow-up",
    name: "Response follow-up",
    status: "inProgress",
    statusLabel: "Enabled",
    updatedAtLabel: placeholderUnavailableLabel,
  },
  {
    activityLabel: placeholderUnavailableLabel,
    createdAtLabel: placeholderUnavailableLabel,
    id: "response-completed-draft",
    name: "Ending card follow-up",
    status: "draft",
    statusLabel: "Draft",
    updatedAtLabel: placeholderUnavailableLabel,
  },
  {
    activityLabel: placeholderUnavailableLabel,
    createdAtLabel: placeholderUnavailableLabel,
    id: "team-notification-follow-up",
    name: "Team notification",
    status: "paused",
    statusLabel: "Disabled",
    updatedAtLabel: placeholderUnavailableLabel,
  },
] as const satisfies readonly {
  activityLabel: string;
  createdAtLabel: string;
  id: string;
  name: string;
  status: TWorkflowStatus;
  statusLabel: string;
  updatedAtLabel: string;
}[];

export const placeholderWorkflowAction = {
  body: "Hi Alex, thanks for completing the survey. We will follow up with next steps shortly.",
  email: "respondent@example.com",
  name: "Send email",
  subject: "Thanks for your answers!",
  type: "send.email",
} as const;

export const placeholderWorkflowBuilderBadge = {
  label: "Draft",
  type: "gray",
} as const satisfies {
  label: string;
  type: TBadgeType;
};

export const placeholderWorkflowRuns = [
  {
    createdAtLabel: placeholderUnavailableLabel,
    description: "Survey response matched the ending-card condition.",
    id: "run_placeholder_completed",
    logs: [
      {
        level: "info",
        message: "Received response.completed trigger.",
      },
      {
        level: "info",
        message: "Matched ending-card condition.",
      },
      {
        level: "info",
        message: "Queued send.email action.",
      },
    ],
    mode: "dryRun",
    responseId: "response_placeholder",
    statusLabel: "Completed",
    statusType: "success",
    timeLabel: placeholderUnavailableLabel,
    trigger: "response.completed",
    workflowId: "response-completed-follow-up",
  },
  {
    createdAtLabel: placeholderUnavailableLabel,
    description: "Manual dry run from the workflow builder.",
    id: "run_placeholder_dry_run",
    logs: [
      {
        level: "info",
        message: "Started manual dry run.",
      },
    ],
    mode: "dryRun",
    responseId: "response_placeholder",
    statusLabel: "Dry run",
    statusType: "gray",
    timeLabel: placeholderUnavailableLabel,
    trigger: "response.completed",
    workflowId: "response-completed-draft",
  },
  {
    createdAtLabel: placeholderUnavailableLabel,
    description: "Email provider returned a delivery error.",
    id: "run_placeholder_failed",
    logs: [
      {
        level: "error",
        message: "Email provider returned a delivery error.",
      },
    ],
    mode: "live",
    responseId: "response_placeholder",
    statusLabel: "Failed",
    statusType: "error",
    timeLabel: placeholderUnavailableLabel,
    trigger: "response.completed",
    workflowId: "team-notification-follow-up",
  },
] as const satisfies readonly {
  createdAtLabel: string;
  description: string;
  id: string;
  logs: readonly {
    level: string;
    message: string;
  }[];
  mode: string;
  responseId: string;
  statusLabel: string;
  statusType: TBadgeType;
  timeLabel: string;
  trigger: string;
  workflowId: (typeof placeholderWorkflows)[number]["id"];
}[];

export type TPlaceholderWorkflowAction = typeof placeholderWorkflowAction;

export const getPlaceholderWorkflow = (workflowId: string) =>
  placeholderWorkflows.find((workflow) => workflow.id === workflowId);

export const getPlaceholderWorkflowRuns = (workflowId?: string) =>
  workflowId
    ? placeholderWorkflowRuns.filter((run) => run.workflowId === workflowId)
    : placeholderWorkflowRuns;

export const getPlaceholderWorkflowRun = (workflowId: string, runId: string) =>
  placeholderWorkflowRuns.find((run) => run.workflowId === workflowId && run.id === runId);
