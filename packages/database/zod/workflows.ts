import type { Workflow, WorkflowRun, WorkflowRunLog, WorkflowVersion } from "@prisma/client";
import { z } from "zod";
import {
  ZWorkflowDefinition,
  ZWorkflowExecutableDefinition,
  ZWorkflowRunData,
  ZWorkflowRunLogInput,
  ZWorkflowRunLogOutput,
  ZWorkflowRunLogStatus,
  ZWorkflowRunStatus,
  ZWorkflowStatus,
  ZWorkflowTriggerRunPayload,
  ZWorkflowTriggerType,
} from "@formbricks/workflows";

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
  startedAt: z.coerce.date().nullable().describe("The date and time the workflow run started"),
  finishedAt: z.coerce.date().nullable().describe("The date and time the workflow run finished"),
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
