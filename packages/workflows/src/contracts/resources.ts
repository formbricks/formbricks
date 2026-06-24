import { z } from "zod";
import { ZWorkflowStatus } from "../types/common";
import { ZWorkflowDefinition } from "../types/document";
import {
  ZWorkflowRunData,
  ZWorkflowRunLog,
  ZWorkflowRunStatus,
  ZWorkflowTriggerRunPayload,
} from "../types/runs";
import { ZWorkflowTriggerType } from "../types/triggers";
import { ZIsoDateTime } from "./common";

/**
 * API resource shapes returned by the v3 Workflows endpoints. These are the serializer outputs:
 * dates are ISO 8601 strings, derived projections (`triggerType`, `surveyId`, `lastRun`) are
 * always present, and nullable fields are emitted explicitly rather than omitted. They are
 * intentionally distinct from row shapes in `@formbricks/database`.
 */

export const ZWorkflowRunSummary = z
  .object({
    id: z.cuid2(),
    workflowId: z.cuid2(),
    workspaceId: z.cuid2(),
    workflowVersionId: z
      .cuid2()
      .nullable()
      .describe(
        "Immutable workflow version snapshot the run executes against. Null for dry runs of never-enabled workflows."
      ),
    status: ZWorkflowRunStatus,
    isDryRun: z.boolean(),
    triggerType: ZWorkflowTriggerType,
    surveyId: z.cuid2().nullable(),
    responseId: z
      .cuid2()
      .nullable()
      .describe("Survey response that triggered the run. Null for synthesized dry-run data."),
    error: z.string().nullable().describe("Terminal or most recent failure reason."),
    attempt: z.number().int().nonnegative().describe("Retry attempt counter; retries never change status."),
    createdAt: ZIsoDateTime,
    updatedAt: ZIsoDateTime,
    startedAt: ZIsoDateTime.nullable(),
    finishedAt: ZIsoDateTime.nullable(),
  })
  .describe("Slim run shape returned by run lists and embedded as lastRun in workflow resources.");
export type TWorkflowRunSummary = z.infer<typeof ZWorkflowRunSummary>;

export const ZWorkflowRunLogResource = ZWorkflowRunLog.required({
  input: true,
  output: true,
  error: true,
  startedAt: true,
  finishedAt: true,
}).describe("Persisted trace entry for one run step, with every field emitted explicitly.");
export type TWorkflowRunLogResource = z.infer<typeof ZWorkflowRunLogResource>;

export const ZWorkflowRunResource = ZWorkflowRunSummary.extend({
  triggerPayload: ZWorkflowTriggerRunPayload,
  data: ZWorkflowRunData,
  logs: z
    .array(ZWorkflowRunLogResource)
    .describe("Persisted step-by-step trace ordered by sequence. Empty while the run is queued."),
  idempotencyKey: z.string().nullable().describe("Deduplication key for this run, unique per workflow."),
  nextAttemptAt: ZIsoDateTime.nullable(),
  lastErrorAt: ZIsoDateTime.nullable(),
}).describe("Full debug-oriented run shape returned by run detail and dry-run creation.");
export type TWorkflowRunResource = z.infer<typeof ZWorkflowRunResource>;

export const ZWorkflowListItem = z
  .object({
    id: z.cuid2(),
    workspaceId: z.cuid2(),
    name: z.string().min(1),
    description: z.string().nullable(),
    status: ZWorkflowStatus,
    triggerType: ZWorkflowTriggerType.describe("Derived from definition.trigger.triggerType."),
    surveyId: z.cuid2().describe("Derived from definition.trigger.config.surveyId."),
    createdBy: z.cuid2().nullable().describe("Null when the creating user was deleted."),
    creator: z
      .object({ name: z.string() })
      .nullable()
      .describe("Creating user's name; null when the creator was deleted."),
    createdAt: ZIsoDateTime,
    updatedAt: ZIsoDateTime,
    lastRun: ZWorkflowRunSummary.nullable().describe(
      "Most recent run summary (dry runs included). Null when the workflow has never run."
    ),
  })
  .describe("Slim workflow shape returned by the workflow list. Excludes the definition.");
export type TWorkflowListItem = z.infer<typeof ZWorkflowListItem>;

export const ZWorkflowResource = ZWorkflowListItem.extend({
  definition: ZWorkflowDefinition,
}).describe("Full workflow shape returned by detail, create, update, duplicate, and lifecycle operations.");
export type TWorkflowResource = z.infer<typeof ZWorkflowResource>;
