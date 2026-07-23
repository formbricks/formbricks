import { z } from "zod";
import { ZWorkflowStatus } from "../types/common";
import { ZWorkflowDefinition } from "../types/document";
import { ZWorkflowRunStatus } from "../types/runs";

/**
 * Route-agnostic operation inputs for the v3 Workflows API. HTTP concerns (the `filter[...]`
 * query family, the `Idempotency-Key` header, path params) are parsed by the transport layer
 * into these shapes; non-HTTP consumers can construct them directly.
 */

export const ZCreateWorkflowInput = z
  .strictObject({
    workspaceId: z.cuid2(),
    name: z.string().min(1).max(120),
    description: z.string().max(500).nullable().optional(),
    status: z
      .literal("draft")
      .optional()
      .describe("Workflows are always created as drafts; only enable can make them live."),
    definition: ZWorkflowDefinition,
  })
  .describe("Creates a draft workflow.");
export type TCreateWorkflowInput = z.infer<typeof ZCreateWorkflowInput>;

export const ZPatchWorkflowInput = z
  .strictObject({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(500).nullable().optional(),
    definition: ZWorkflowDefinition.optional().describe(
      "Only accepted while the workflow is draft or disabled; the live version of an enabled workflow is immutable."
    ),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one field must be provided",
  })
  .describe("Partial workflow update. Status is never patchable; use the lifecycle operations.");
export type TPatchWorkflowInput = z.infer<typeof ZPatchWorkflowInput>;

export const ZDuplicateWorkflowInput = z
  .strictObject({
    name: z
      .string()
      .min(1)
      .max(120)
      .optional()
      .describe("Optional name for the duplicate. If omitted, the server generates a copy-suffixed name."),
  })
  .describe("Duplicates a workflow as a new draft with empty run and version history.");
export type TDuplicateWorkflowInput = z.infer<typeof ZDuplicateWorkflowInput>;

export const ZTestWorkflowInput = z
  .strictObject({
    responseId: z
      .cuid2()
      .optional()
      .describe(
        "Optional existing response (from the trigger's survey) to replay as dry-run sample data. When omitted, the server synthesizes a sample payload."
      ),
    idempotencyKey: z
      .string()
      .min(1)
      .max(255)
      .optional()
      .describe(
        "Route-agnostic form of the Idempotency-Key header. Unique per workflow; retries with the same key return the previously created run."
      ),
  })
  .describe("Creates an asynchronous dry run that validates and mocks execution without side effects.");
export type TTestWorkflowInput = z.infer<typeof ZTestWorkflowInput>;

export const ZWorkflowSortBy = z.enum(["createdAt", "updatedAt", "name"]);
export type TWorkflowSortBy = z.infer<typeof ZWorkflowSortBy>;

export const ZListWorkflowsInput = z
  .strictObject({
    workspaceId: z.cuid2(),
    limit: z.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).optional().describe("Opaque cursor from the previous page's meta.nextCursor."),
    statusIn: z
      .array(ZWorkflowStatus)
      .min(1)
      .optional()
      .describe("Parsed form of filter[status][in]. Omitting it returns every status except archived."),
    nameContains: z
      .string()
      .min(1)
      .max(512)
      .optional()
      .describe("Parsed form of filter[name][contains]; case-insensitive substring match."),
    sortBy: ZWorkflowSortBy.default("updatedAt").describe(
      "The cursor token is bound to the selected sort order."
    ),
  })
  .describe("Lists workflow list items for a workspace.");
export type TListWorkflowsInput = z.infer<typeof ZListWorkflowsInput>;

export const ZListWorkflowRunsInput = z
  .strictObject({
    workspaceId: z.cuid2(),
    limit: z.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).optional().describe("Opaque cursor from the previous page's meta.nextCursor."),
    workflowId: z.cuid2().optional().describe("Returns only runs of this workflow."),
    responseId: z.cuid2().optional().describe("Returns only runs triggered by this survey response."),
    statusIn: z.array(ZWorkflowRunStatus).min(1).optional().describe("Parsed form of filter[status][in]."),
    isDryRun: z
      .boolean()
      .optional()
      .describe("Parsed form of filter[isDryRun][eq]. Omit to return real and dry runs."),
  })
  .describe("Lists workflow run summaries for a workspace, newest first.");
export type TListWorkflowRunsInput = z.infer<typeof ZListWorkflowRunsInput>;
