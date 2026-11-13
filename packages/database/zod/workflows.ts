import { z } from "zod";
import {
  ZWorkflowDefinition,
  ZWorkflowExecutableDefinition,
  ZWorkflowRunData,
  ZWorkflowRunLogInput,
  ZWorkflowRunLogOutput,
  ZWorkflowRunLogStatus,
  ZWorkflowRunStatus,
  ZWorkflowSampleData,
  ZWorkflowStatus,
  ZWorkflowTriggerRunPayload,
  ZWorkflowTriggerType,
} from "@formbricks/workflows";
import type { Workflow, WorkflowRun, WorkflowRunLog, WorkflowSample, WorkflowVersion } from "../src/prisma";

export const ZWorkflow = z.object({
  id: z.cuid2().describe("The ID of the workflow"),
  createdAt: z.coerce.date().describe("The date and time the workflow was created"),
  updatedAt: z.coerce.date().describe("The date and time the workflow was last updated"),
  name: z.string().describe("The workflow name"),
  description: z.string().nullable().describe("The workflow description"),
  status: ZWorkflowStatus.describe("The workflow status"),
  workspaceId: z.cuid2().describe("The workspace ID of the workflow"),
  createdBy: z.cuid2().nullable().describe("The user who created the workflow"),
  definition: ZWorkflowDefinition.describe("The persisted workflow definition"),
  webhookTokenHash: z
    .string()
    .nullable()
    .describe("SHA-256 hash of the Webhook Secret URL token. Never returned by the API."),
  webhookTokenEncrypted: z
    .string()
    .nullable()
    .describe("Encrypted Webhook Secret URL token. Never returned by the API."),
}) satisfies z.ZodType<Workflow>;

export const ZWorkflowVersion = z.object({
  id: z.cuid2().describe("The ID of the workflow version"),
  workflowId: z.cuid2().describe("The workflow ID"),
  workspaceId: z.cuid2().describe("The workspace ID"),
  version: z.number().int().positive().describe("The workflow version number"),
  definition: ZWorkflowExecutableDefinition.describe("The immutable executable workflow definition"),
  publishedAt: z.coerce.date().describe("The date and time the workflow version was published"),
  publishedBy: z.cuid2().nullable().describe("The user who published the workflow version"),
}) satisfies z.ZodType<WorkflowVersion>;

export const ZWorkflowRun = z.object({
  id: z.cuid2().describe("The ID of the workflow run"),
  createdAt: z.coerce.date().describe("The date and time the workflow run was created"),
  updatedAt: z.coerce.date().describe("The date and time the workflow run was last updated"),
  workflowId: z.cuid2().describe("The workflow ID"),
  workspaceId: z.cuid2().describe("The workspace ID"),
  workflowVersionId: z.cuid2().nullable().describe("The workflow version ID"),
  responseId: z.cuid2().nullable().describe("The response ID that triggered the workflow run"),
  status: ZWorkflowRunStatus.describe("The workflow run status"),
  triggerType: ZWorkflowTriggerType.describe("The trigger type that started the workflow run"),
  surveyId: z.cuid2().nullable().describe("The survey ID that triggered the workflow run"),
  isDryRun: z.boolean().describe("Whether the workflow run is a dry run"),
  idempotencyKey: z.string().nullable().describe("The workflow run idempotency key"),
  attempt: z.number().int().nonnegative().describe("The workflow run attempt count"),
  nextAttemptAt: z.coerce.date().nullable().describe("The next retry time"),
  lastErrorAt: z.coerce.date().nullable().describe("The last error time"),
  triggerPayload: ZWorkflowTriggerRunPayload.describe(
    "The trigger payload snapshot captured when the run was created"
  ),
  data: ZWorkflowRunData.describe("The workflow run data"),
  error: z.string().nullable().describe("The workflow run error"),
  dispatchedAt: z.coerce
    .date()
    .nullable()
    .describe("The date and time the workflow run was handed off to the queue"),
  startedAt: z.coerce.date().nullable().describe("The date and time the workflow run started"),
  finishedAt: z.coerce.date().nullable().describe("The date and time the workflow run finished"),
  callerIp: z.string().nullable().describe("The caller's IP for a run started by a Webhook Secret URL call"),
  contentDeletedAt: z.coerce
    .date()
    .nullable()
    .describe("When the run's content (payload, step data, errors) was cleared by the retention job"),
  contentRetentionDays: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe("The retention period, in days, that cleared the run's content"),
}) satisfies z.ZodType<WorkflowRun>;

export const ZWorkflowRunLog = z.object({
  id: z.cuid2().describe("The ID of the workflow run log"),
  runId: z.cuid2().describe("The workflow run ID"),
  sequence: z.number().int().nonnegative().describe("The sequence number within the run"),
  stepId: z.string().min(1).describe("The workflow step ID"),
  stepType: z.string().min(1).describe("The workflow step type"),
  status: ZWorkflowRunLogStatus.describe("The workflow run log status"),
  input: ZWorkflowRunLogInput.describe("The step input"),
  output: ZWorkflowRunLogOutput.describe("The step output"),
  error: z.string().nullable().describe("The workflow run log error"),
  startedAt: z.coerce.date().nullable().describe("The date and time the step started"),
  finishedAt: z.coerce.date().nullable().describe("The date and time the step finished"),
}) satisfies z.ZodType<WorkflowRunLog>;

export const ZWorkflowSample = z.object({
  id: z.cuid2().describe("The ID of the workflow sample"),
  createdAt: z.coerce.date().describe("The date and time the sample was created"),
  updatedAt: z.coerce.date().describe("The date and time the sample was last updated"),
  workflowId: z.cuid2().describe("The workflow ID"),
  workspaceId: z.cuid2().describe("The workspace ID"),
  source: z.string().min(1).describe("`trigger`, or the id of the HTTP request step the sample belongs to"),
  sample: ZWorkflowSampleData.describe("The last sample payload or Test request response"),
  lastCalledAt: z.coerce.date().nullable().describe("When the Webhook Secret URL was last called"),
  lastCallerIp: z.string().nullable().describe("The IP of the last Webhook Secret URL call"),
}) satisfies z.ZodType<WorkflowSample>;

ZWorkflow.meta({
  id: "workflow",
}).describe("A workflow");

ZWorkflowVersion.meta({
  id: "workflowVersion",
}).describe("A workflow version");

ZWorkflowRun.meta({
  id: "workflowRun",
}).describe("A workflow run");

ZWorkflowRunLog.meta({
  id: "workflowRunLog",
}).describe("A workflow run log");

ZWorkflowSample.meta({
  id: "workflowSample",
}).describe("A workflow sample payload");
