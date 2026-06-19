import type { TFunction } from "i18next";
import type {
  TWorkflowDefinition,
  TWorkflowListItem,
  TWorkflowResource,
  TWorkflowRunResource,
  TWorkflowSendEmailActionNode,
} from "@formbricks/workflows";
import { formatRelativeDate } from "@/modules/workflows/lib/format-date";

// Placeholder/mock data for the in-progress workflows UI. Shaped to the real
// @formbricks/workflows resource types so routes can pass it straight to the
// components. Only routes should import this module — components stay decoupled.
// IDs are cuid2-shaped so the v3 API path validator accepts them; the API itself
// will still 403 (no DB row) — the builder short-circuits when a placeholder id
// is requested.

const WORKSPACE_ID = "wsplaceholderworkspace01";
const SURVEY_ID = "svplaceholdersurvey00001";
const RESPONSE_ID = "rsplaceholderresponse001";
const ENDING_CARD_ID_A = "endingplaceholdercardaa1";
const ENDING_CARD_ID_B = "endingplaceholdercardbb1";

const RESPONSE_FOLLOW_UP_ID = "wfresponsefollowupplc001";
const ENDING_CARD_FOLLOW_UP_ID = "wfendingcardfollowupplc1";
const TEAM_NOTIFICATION_ID = "wfteamnotificationplc001";

// Fixed anchor for the placeholder dataset. All run timestamps are computed as offsets from this
// anchor so relative dates ("Today, 4:23 PM" / "Yesterday, 6:12 PM" / "2 days ago") render
// deterministically — independent of when the dev server boots.
const PLACEHOLDER_ANCHOR_ISO = "2024-09-15T17:01:00.000Z";
const PLACEHOLDER_ANCHOR = new Date(PLACEHOLDER_ANCHOR_ISO);

const isoFromMinutesAgo = (minutesAgo: number): string =>
  new Date(PLACEHOLDER_ANCHOR.getTime() - minutesAgo * 60_000).toISOString();

interface RunTemplate {
  id: string;
  workflowId: string;
  status: TWorkflowRunResource["status"];
  isDryRun: boolean;
  error: string | null;
  attempt: number;
  minutesAgo: number;
  durationSeconds: number | null;
}

const RUN_TEMPLATES: RunTemplate[] = [
  // Response follow-up — 8 runs, 1 failed (most-recent first)
  {
    id: "runrfup00000000000000001",
    workflowId: RESPONSE_FOLLOW_UP_ID,
    status: "completed",
    isDryRun: false,
    error: null,
    attempt: 0,
    minutesAgo: 0,
    durationSeconds: 9,
  },
  {
    id: "runrfup00000000000000002",
    workflowId: RESPONSE_FOLLOW_UP_ID,
    status: "completed",
    isDryRun: false,
    error: null,
    attempt: 0,
    minutesAgo: 38,
    durationSeconds: 11,
  },
  {
    id: "runrfup00000000000000003",
    workflowId: RESPONSE_FOLLOW_UP_ID,
    status: "completed",
    isDryRun: false,
    error: null,
    attempt: 0,
    minutesAgo: 156,
    durationSeconds: 8,
  },
  {
    id: "runrfup00000000000000004",
    workflowId: RESPONSE_FOLLOW_UP_ID,
    status: "completed",
    isDryRun: false,
    error: null,
    attempt: 0,
    minutesAgo: 24 * 60 + 30,
    durationSeconds: 10,
  },
  {
    id: "runrfup00000000000000005",
    workflowId: RESPONSE_FOLLOW_UP_ID,
    status: "failed",
    isDryRun: false,
    error: "Email provider returned a delivery error.",
    attempt: 1,
    minutesAgo: 28 * 60,
    durationSeconds: 5,
  },
  {
    id: "runrfup00000000000000006",
    workflowId: RESPONSE_FOLLOW_UP_ID,
    status: "completed",
    isDryRun: false,
    error: null,
    attempt: 0,
    minutesAgo: 49 * 60,
    durationSeconds: 12,
  },
  {
    id: "runrfup00000000000000007",
    workflowId: RESPONSE_FOLLOW_UP_ID,
    status: "completed",
    isDryRun: false,
    error: null,
    attempt: 0,
    minutesAgo: 73 * 60,
    durationSeconds: 10,
  },
  {
    id: "runrfup00000000000000008",
    workflowId: RESPONSE_FOLLOW_UP_ID,
    status: "completed",
    isDryRun: true,
    error: null,
    attempt: 0,
    minutesAgo: 96 * 60,
    durationSeconds: 9,
  },

  // Ending card follow-up — 3 runs, 0 failed
  {
    id: "runecfu00000000000000001",
    workflowId: ENDING_CARD_FOLLOW_UP_ID,
    status: "queued",
    isDryRun: true,
    error: null,
    attempt: 0,
    minutesAgo: 12,
    durationSeconds: null,
  },
  {
    id: "runecfu00000000000000002",
    workflowId: ENDING_CARD_FOLLOW_UP_ID,
    status: "completed",
    isDryRun: false,
    error: null,
    attempt: 0,
    minutesAgo: 30 * 60,
    durationSeconds: 7,
  },
  {
    id: "runecfu00000000000000003",
    workflowId: ENDING_CARD_FOLLOW_UP_ID,
    status: "completed",
    isDryRun: false,
    error: null,
    attempt: 0,
    minutesAgo: 56 * 60,
    durationSeconds: 9,
  },

  // Team notification — 7 runs, 2 failed
  {
    id: "runtnot00000000000000001",
    workflowId: TEAM_NOTIFICATION_ID,
    status: "failed",
    isDryRun: false,
    error: "Email provider returned a delivery error.",
    attempt: 1,
    minutesAgo: 0,
    durationSeconds: 6,
  },
  {
    id: "runtnot00000000000000002",
    workflowId: TEAM_NOTIFICATION_ID,
    status: "completed",
    isDryRun: false,
    error: null,
    attempt: 0,
    minutesAgo: 136,
    durationSeconds: 11,
  },
  {
    id: "runtnot00000000000000003",
    workflowId: TEAM_NOTIFICATION_ID,
    status: "failed",
    isDryRun: false,
    error: "Connection timed out.",
    attempt: 2,
    minutesAgo: 22 * 60 + 49,
    durationSeconds: 7,
  },
  {
    id: "runtnot00000000000000004",
    workflowId: TEAM_NOTIFICATION_ID,
    status: "completed",
    isDryRun: false,
    error: null,
    attempt: 0,
    minutesAgo: 28 * 60 + 1,
    durationSeconds: 14,
  },
  {
    id: "runtnot00000000000000005",
    workflowId: TEAM_NOTIFICATION_ID,
    status: "completed",
    isDryRun: false,
    error: null,
    attempt: 0,
    minutesAgo: 56 * 60 + 46,
    durationSeconds: 12,
  },
  {
    id: "runtnot00000000000000006",
    workflowId: TEAM_NOTIFICATION_ID,
    status: "completed",
    isDryRun: false,
    error: null,
    attempt: 0,
    minutesAgo: 80 * 60,
    durationSeconds: 13,
  },
  {
    id: "runtnot00000000000000007",
    workflowId: TEAM_NOTIFICATION_ID,
    status: "completed",
    isDryRun: false,
    error: null,
    attempt: 0,
    minutesAgo: 100 * 60,
    durationSeconds: 15,
  },
];

const triggerPayload = (responseId: string, triggeredAtIso: string) => ({
  type: "response.completed" as const,
  workspaceId: WORKSPACE_ID,
  surveyId: SURVEY_ID,
  responseId,
  triggeredAt: triggeredAtIso,
});

const buildRunFromTemplate = (template: RunTemplate): TWorkflowRunResource => {
  const createdAtIso = isoFromMinutesAgo(template.minutesAgo);
  const startedAtIso = template.status === "queued" ? null : createdAtIso;
  const finishedAtIso =
    template.status === "queued" || template.durationSeconds === null
      ? null
      : new Date(new Date(createdAtIso).getTime() + template.durationSeconds * 1000).toISOString();

  return {
    id: template.id,
    workflowId: template.workflowId,
    workspaceId: WORKSPACE_ID,
    workflowVersionId: null,
    status: template.status,
    isDryRun: template.isDryRun,
    triggerType: "response.completed",
    surveyId: SURVEY_ID,
    responseId: RESPONSE_ID,
    error: template.error,
    attempt: template.attempt,
    createdAt: createdAtIso,
    updatedAt: finishedAtIso ?? createdAtIso,
    startedAt: startedAtIso,
    finishedAt: finishedAtIso,
    triggerPayload: triggerPayload(RESPONSE_ID, createdAtIso),
    data: { steps: [] },
    logs:
      template.status === "queued"
        ? []
        : [
            {
              id: `${template.id}-log-send-email`,
              runId: template.id,
              sequence: 0,
              stepId: "send-email",
              stepType: "send.email",
              status: template.status === "failed" ? "failed" : "succeeded",
              input: {},
              output: {},
              error: template.error,
              startedAt: startedAtIso ?? createdAtIso,
              finishedAt: finishedAtIso ?? createdAtIso,
            },
          ],
    idempotencyKey: null,
    nextAttemptAt: null,
    lastErrorAt: template.status === "failed" ? finishedAtIso : null,
  };
};

export const placeholderWorkflowRuns: TWorkflowRunResource[] = RUN_TEMPLATES.map(buildRunFromTemplate);

const buildDefinition = ({
  triggerId,
  actionId,
  edgeId,
  endingCardIds = [],
  to,
  subject,
  body,
}: {
  triggerId: string;
  actionId: string;
  edgeId: string;
  endingCardIds?: string[];
  to: string;
  subject: string;
  body: string;
}): TWorkflowDefinition => ({
  schemaVersion: 1,
  entryNodeId: triggerId,
  trigger: {
    id: triggerId,
    type: "trigger",
    triggerType: "response.completed",
    config: { surveyId: SURVEY_ID, endingCardIds },
    ui: { position: { x: 220, y: 80 } },
  },
  nodes: [
    {
      id: actionId,
      type: "action",
      actionType: "send_email",
      label: "Send email",
      config: {
        to,
        from: "team@example.com",
        replyTo: [],
        subject,
        body,
        attachResponseData: false,
      },
      ui: { position: { x: 220, y: 260 } },
    },
  ],
  edges: [{ id: edgeId, source: triggerId, target: actionId }],
});

const firstRunForWorkflow = (workflowId: string): TWorkflowRunResource | null =>
  placeholderWorkflowRuns.find((run) => run.workflowId === workflowId) ?? null;

export const placeholderWorkflowResources: TWorkflowResource[] = [
  {
    id: RESPONSE_FOLLOW_UP_ID,
    workspaceId: WORKSPACE_ID,
    name: "Response follow-up",
    description: "Email respondents after they complete the survey.",
    status: "enabled",
    triggerType: "response.completed",
    surveyId: SURVEY_ID,
    createdBy: null,
    createdAt: PLACEHOLDER_ANCHOR_ISO,
    updatedAt: PLACEHOLDER_ANCHOR_ISO,
    lastRun: firstRunForWorkflow(RESPONSE_FOLLOW_UP_ID),
    definition: buildDefinition({
      triggerId: "trigresponsefollowupplc1",
      actionId: "actresponsefollowupemail",
      edgeId: "edgresponsefollowuptoemail",
      to: "respondent@example.com",
      subject: "Thanks for your answers!",
      body: "Hi there, thanks for completing the survey. We will follow up with next steps shortly.",
    }),
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
    createdAt: PLACEHOLDER_ANCHOR_ISO,
    updatedAt: PLACEHOLDER_ANCHOR_ISO,
    lastRun: firstRunForWorkflow(ENDING_CARD_FOLLOW_UP_ID),
    definition: buildDefinition({
      triggerId: "trigendingcardfollowupplc",
      actionId: "actendingcardfollowupemail",
      edgeId: "edgendcardfollowuptoemail",
      endingCardIds: [ENDING_CARD_ID_A, ENDING_CARD_ID_B],
      to: "team@example.com",
      subject: "Respondent reached a key ending",
      body: "A respondent reached a tracked ending card. Investigate the response in Formbricks.",
    }),
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
    createdAt: PLACEHOLDER_ANCHOR_ISO,
    updatedAt: PLACEHOLDER_ANCHOR_ISO,
    lastRun: firstRunForWorkflow(TEAM_NOTIFICATION_ID),
    definition: buildDefinition({
      triggerId: "trigteamnotificationplc01",
      actionId: "actteamnotificationemail",
      edgeId: "edgteamnotificationtoemail",
      to: "team@example.com",
      subject: "New survey response received",
      body: "A new response was completed. Check the Formbricks dashboard for details.",
    }),
  },
];

export const placeholderWorkflows: TWorkflowListItem[] = placeholderWorkflowResources.map(
  ({ definition: _definition, ...listItem }) => listItem
);

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

/**
 * Derives the history-section view from the same `placeholderWorkflowRuns` array the runs page
 * consumes, so the two views stay in sync. Returns every row — the consuming component is
 * responsible for paginating. When the real listWorkflowRuns API client lands, the single source
 * of truth above swaps out and this derivation stays unchanged.
 */
export const getPlaceholderWorkflowHistory = (
  workflowId: string,
  t: TFunction
): TWorkflowHistorySummary | undefined => {
  const runs = placeholderWorkflowRuns.filter((run) => run.workflowId === workflowId);
  if (runs.length === 0) return undefined;

  const total = runs.length;
  const failedCount = runs.filter((run) => run.status === "failed").length;
  const failedPercent = Math.round((failedCount / total) * 100);

  const durations = runs
    .filter((run) => run.startedAt && run.finishedAt)
    .map((run) => (new Date(run.finishedAt!).getTime() - new Date(run.startedAt!).getTime()) / 1000);
  const avgSeconds = durations.length
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : 0;

  const rows: TWorkflowHistoryRow[] = runs.map((run) => ({
    id: run.id,
    date: formatRelativeDate(run.createdAt, PLACEHOLDER_ANCHOR, t),
    status: run.status === "failed" ? "fail" : "success",
  }));

  return {
    totalRuns: String(total),
    failed: `${failedCount} (${failedPercent}%)`,
    avgRunTime: `${avgSeconds}s`,
    rows,
  };
};

export interface TWorkflowOperationalSettings {
  capRunsEnabled: boolean;
  capRunsLimit: string;
  capRunsUnit: "hour" | "day" | "week";
  aiOverview?: string;
}

const PLACEHOLDER_SETTINGS: Record<string, TWorkflowOperationalSettings> = {
  [RESPONSE_FOLLOW_UP_ID]: {
    capRunsEnabled: true,
    capRunsLimit: "10",
    capRunsUnit: "day",
    aiOverview: "When a new response is received from a new user, email the respondent to follow up.",
  },
  [ENDING_CARD_FOLLOW_UP_ID]: {
    capRunsEnabled: false,
    capRunsLimit: "20",
    capRunsUnit: "day",
    aiOverview: "When a respondent reaches a tracked ending card, notify the team via email.",
  },
  [TEAM_NOTIFICATION_ID]: {
    capRunsEnabled: true,
    capRunsLimit: "100",
    capRunsUnit: "hour",
    aiOverview: "When any new response is completed, send the team an internal email notification.",
  },
};

export const getPlaceholderWorkflowSettings = (
  workflowId: string
): TWorkflowOperationalSettings | undefined => PLACEHOLDER_SETTINGS[workflowId];

export const placeholderWorkflowActionNode: TWorkflowSendEmailActionNode = {
  id: "actplaceholdersendemail01",
  type: "action",
  actionType: "send_email",
  label: "Send email",
  config: {
    to: "respondent@example.com",
    from: "team@example.com",
    replyTo: [],
    subject: "Thanks for your answers!",
    body: "Hi there, thanks for completing the survey. We will follow up with next steps shortly.",
    attachResponseData: false,
  },
};

export const getPlaceholderWorkflow = (workflowId: string): TWorkflowListItem | undefined =>
  placeholderWorkflows.find((workflow) => workflow.id === workflowId);

export const getPlaceholderWorkflowResource = (workflowId: string): TWorkflowResource | undefined =>
  placeholderWorkflowResources.find((workflow) => workflow.id === workflowId);

export const getPlaceholderWorkflowRuns = (workflowId?: string): TWorkflowRunResource[] =>
  workflowId
    ? placeholderWorkflowRuns.filter((run) => run.workflowId === workflowId)
    : placeholderWorkflowRuns;
