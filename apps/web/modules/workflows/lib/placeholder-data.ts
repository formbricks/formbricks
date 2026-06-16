import type {
  TWorkflowListItem,
  TWorkflowRunResource,
  TWorkflowSendEmailActionNode,
} from "@formbricks/workflows";

// Placeholder/mock data for the in-progress workflows UI. Shaped to the real
// @formbricks/workflows resource types so routes can pass it straight to the
// components. Only routes should import this module - components stay decoupled.

const WORKSPACE_ID = "placeholder-workspace-id";
const SURVEY_ID = "placeholder-survey-id";
const RESPONSE_ID = "placeholder-response-id";
const TIMESTAMP = "2024-01-15T10:00:00.000Z";

const RESPONSE_FOLLOW_UP_ID = "019ecf4c-1fca-723d-9228-ae23e8f2bcc3";
const ENDING_CARD_FOLLOW_UP_ID = "019ecf4c-1fca-776c-8ee4-56e9ce4a879d";
const TEAM_NOTIFICATION_ID = "019ecf4c-1fca-7790-94bd-7de1ffbd2a17";

const triggerPayload = (responseId: string) => ({
  type: "response.completed" as const,
  workspaceId: WORKSPACE_ID,
  surveyId: SURVEY_ID,
  responseId,
  triggeredAt: TIMESTAMP,
});

export const placeholderWorkflowRuns: TWorkflowRunResource[] = [
  {
    id: "019ecf4c-1fca-7b72-bc62-70f4380c293e",
    workflowId: RESPONSE_FOLLOW_UP_ID,
    workspaceId: WORKSPACE_ID,
    workflowVersionId: null,
    status: "completed",
    isDryRun: true,
    triggerType: "response.completed",
    surveyId: SURVEY_ID,
    responseId: RESPONSE_ID,
    error: null,
    attempt: 0,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    startedAt: TIMESTAMP,
    finishedAt: TIMESTAMP,
    triggerPayload: triggerPayload(RESPONSE_ID),
    data: { steps: [] },
    logs: [
      {
        id: "019ecf4c-1fca-7b72-bc62-70f4380c2901",
        runId: "019ecf4c-1fca-7b72-bc62-70f4380c293e",
        sequence: 0,
        stepId: "trigger",
        stepType: "trigger",
        status: "succeeded",
        input: {},
        output: {},
        error: null,
        startedAt: TIMESTAMP,
        finishedAt: TIMESTAMP,
      },
      {
        id: "019ecf4c-1fca-7b72-bc62-70f4380c2902",
        runId: "019ecf4c-1fca-7b72-bc62-70f4380c293e",
        sequence: 1,
        stepId: "send-email",
        stepType: "send.email",
        status: "succeeded",
        input: {},
        output: {},
        error: null,
        startedAt: TIMESTAMP,
        finishedAt: TIMESTAMP,
      },
    ],
    idempotencyKey: null,
    nextAttemptAt: null,
    lastErrorAt: null,
  },
  {
    id: "019ecf4d-1fe5-7a35-9bb6-d8134729e491",
    workflowId: ENDING_CARD_FOLLOW_UP_ID,
    workspaceId: WORKSPACE_ID,
    workflowVersionId: null,
    status: "queued",
    isDryRun: true,
    triggerType: "response.completed",
    surveyId: SURVEY_ID,
    responseId: RESPONSE_ID,
    error: null,
    attempt: 0,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    startedAt: null,
    finishedAt: null,
    triggerPayload: triggerPayload(RESPONSE_ID),
    data: { steps: [] },
    logs: [],
    idempotencyKey: null,
    nextAttemptAt: null,
    lastErrorAt: null,
  },
  {
    id: "019ecf4d-1fe5-76e5-9032-a9cf1e403cfd",
    workflowId: TEAM_NOTIFICATION_ID,
    workspaceId: WORKSPACE_ID,
    workflowVersionId: null,
    status: "failed",
    isDryRun: false,
    triggerType: "response.completed",
    surveyId: SURVEY_ID,
    responseId: RESPONSE_ID,
    error: "Email provider returned a delivery error.",
    attempt: 1,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    startedAt: TIMESTAMP,
    finishedAt: TIMESTAMP,
    triggerPayload: triggerPayload(RESPONSE_ID),
    data: { steps: [] },
    logs: [
      {
        id: "019ecf4d-1fe5-76e5-9032-a9cf1e403c01",
        runId: "019ecf4d-1fe5-76e5-9032-a9cf1e403cfd",
        sequence: 0,
        stepId: "send-email",
        stepType: "send.email",
        status: "failed",
        input: {},
        output: {},
        error: "Email provider returned a delivery error.",
        startedAt: TIMESTAMP,
        finishedAt: TIMESTAMP,
      },
    ],
    idempotencyKey: null,
    nextAttemptAt: null,
    lastErrorAt: TIMESTAMP,
  },
];

export const placeholderWorkflows: TWorkflowListItem[] = [
  {
    id: RESPONSE_FOLLOW_UP_ID,
    workspaceId: WORKSPACE_ID,
    name: "Response follow-up",
    description: "Email respondents after they complete the survey.",
    status: "enabled",
    triggerType: "response.completed",
    surveyId: SURVEY_ID,
    createdBy: null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    lastRun: placeholderWorkflowRuns[0],
  },
  {
    id: ENDING_CARD_FOLLOW_UP_ID,
    workspaceId: WORKSPACE_ID,
    name: "Ending card follow-up",
    description: "Notify the team when a specific ending card is reached.",
    status: "draft",
    triggerType: "response.completed",
    surveyId: SURVEY_ID,
    createdBy: null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    lastRun: placeholderWorkflowRuns[1],
  },
  {
    id: TEAM_NOTIFICATION_ID,
    workspaceId: WORKSPACE_ID,
    name: "Team notification",
    description: "Send an internal notification for every completed response.",
    status: "disabled",
    triggerType: "response.completed",
    surveyId: SURVEY_ID,
    createdBy: null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    lastRun: placeholderWorkflowRuns[2],
  },
];

export const placeholderWorkflowActionNode: TWorkflowSendEmailActionNode = {
  id: "placeholder-action-send-email",
  type: "action",
  actionType: "send_email",
  label: "Send email",
  config: {
    to: "respondent@example.com",
    from: "team@example.com",
    replyTo: [],
    subject: "Thanks for your answers!",
    body: "Hi Alex, thanks for completing the survey. We will follow up with next steps shortly.",
    attachResponseData: false,
  },
};

export const getPlaceholderWorkflow = (workflowId: string): TWorkflowListItem | undefined =>
  placeholderWorkflows.find((workflow) => workflow.id === workflowId);

export const getPlaceholderWorkflowRuns = (workflowId?: string): TWorkflowRunResource[] =>
  workflowId
    ? placeholderWorkflowRuns.filter((run) => run.workflowId === workflowId)
    : placeholderWorkflowRuns;
