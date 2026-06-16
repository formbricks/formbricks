type TWorkflowStatus = "draft" | "inProgress" | "paused";
type TBadgeType = "error" | "gray" | "success" | "warning";

export const placeholderUnavailableLabel = "Not set";

export const placeholderWorkflows = [
  {
    activityLabel: placeholderUnavailableLabel,
    createdAtLabel: placeholderUnavailableLabel,
    id: "019ecf4c-1fca-723d-9228-ae23e8f2bcc3",
    name: "Response follow-up",
    status: "inProgress",
    statusLabel: "Enabled",
    updatedAtLabel: placeholderUnavailableLabel,
  },
  {
    activityLabel: placeholderUnavailableLabel,
    createdAtLabel: placeholderUnavailableLabel,
    id: "019ecf4c-1fca-776c-8ee4-56e9ce4a879d",
    name: "Ending card follow-up",
    status: "draft",
    statusLabel: "Draft",
    updatedAtLabel: placeholderUnavailableLabel,
  },
  {
    activityLabel: placeholderUnavailableLabel,
    createdAtLabel: placeholderUnavailableLabel,
    id: "019ecf4c-1fca-7790-94bd-7de1ffbd2a17",
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
    id: "019ecf4c-1fca-7b72-bc62-70f4380c293e",
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
    workflowId: "019ecf4c-1fca-723d-9228-ae23e8f2bcc3",
  },
  {
    createdAtLabel: placeholderUnavailableLabel,
    description: "Manual dry run from the workflow builder.",
    id: "019ecf4d-1fe5-7a35-9bb6-d8134729e491",
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
    workflowId: "019ecf4c-1fca-776c-8ee4-56e9ce4a879d",
  },
  {
    createdAtLabel: placeholderUnavailableLabel,
    description: "Email provider returned a delivery error.",
    id: "019ecf4d-1fe5-76e5-9032-a9cf1e403cfd",
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
    workflowId: "019ecf4c-1fca-7790-94bd-7de1ffbd2a17",
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
