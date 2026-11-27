import { z } from "zod";
import {
  ZCreateWorkflowInputStrict,
  ZPatchWorkflowInputStrict,
  ZWorkflowRunStatus,
  ZWorkflowSortBy,
  ZWorkflowStatus,
} from "@formbricks/workflows";
import { lengthBoundedArray } from "@/app/api/v3/lib/bounded-array";
import { confirmArgument } from "./confirm-argument";

// Array arguments go through `lengthBoundedArray`, as in `./schemas.ts` (ENG-3384).
const MCP_MAX_FILTER_VALUES = 10;

// Every schema here rejects undeclared arguments, for the reasons documented at the top of
// `./schemas.ts` (ENG-2256): an undeclared argument must fail loudly rather than be silently dropped.
// Add `.strict()` to any new schema you add here — except where the base is already a `z.strictObject`,
// in which case leave it alone and see the note on `ZMcpCreateWorkflowInput`.
//
// That includes the workflow `definition` on create/patch: they parse the strict variant of the v3
// contract (ENG-2437), so a misspelled key inside a trigger, step, edge or step `config` fails, naming
// the key, instead of being dropped. The v3 REST route and the builder keep the lenient definition until
// the next major. Builder `ui` metadata stays open on both.

export const ZMcpListWorkflowsInput = z
  .object({
    workspaceId: z.cuid2().describe("Workspace ID whose workflows should be listed."),
    // Matches the HTTP workflows lists, which also cap at 100 — the 250 the rest of v3 moved to did
    // not reach them, because their bound lives in the shared `packages/workflows` contracts. For an
    // agent client that is the right ceiling anyway: the binding constraint is context window rather
    // than server cost, so a larger page would be a cost rather than a convenience.
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .describe("Maximum number of workflows to return. Defaults to 20.")
      .default(20),
    cursor: z
      .string()
      .min(1)
      .optional()
      .describe("Opaque pagination cursor from a previous list_workflows response."),
    filter: z
      .strictObject({
        name: z
          .strictObject({
            contains: z
              .string()
              .min(1)
              .max(512)
              .optional()
              .describe("Case-insensitive workflow name substring."),
          })
          .describe("Filter by workflow name.")
          .optional(),
        status: z
          .strictObject({
            in: lengthBoundedArray(ZWorkflowStatus, {
              min: 1,
              max: MCP_MAX_FILTER_VALUES,
              description: "Workflow statuses to include. Omitting returns every status except archived.",
            }).optional(),
          })
          .describe("Filter by workflow status.")
          .optional(),
      })
      .describe("Optional supported v3 workflow filters.")
      .optional(),
    sortBy: ZWorkflowSortBy.optional().describe(
      "Sort field for pagination. Defaults to the v3 API default of updatedAt."
    ),
  })
  .strict();
export type TMcpListWorkflowsInput = z.infer<typeof ZMcpListWorkflowsInput>;

export const ZMcpGetWorkflowInput = z
  .object({
    workflowId: z.cuid2().describe("Workflow ID to fetch."),
  })
  .strict();
export type TMcpGetWorkflowInput = z.infer<typeof ZMcpGetWorkflowInput>;

export const ZMcpListWorkflowRunsInput = z
  .object({
    workspaceId: z.cuid2().describe("Workspace ID whose workflow runs should be listed."),
    // Matches the HTTP workflows lists, which also cap at 100 — the 250 the rest of v3 moved to did
    // not reach them, because their bound lives in the shared `packages/workflows` contracts. For an
    // agent client that is the right ceiling anyway: the binding constraint is context window rather
    // than server cost, so a larger page would be a cost rather than a convenience.
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .describe("Maximum number of runs to return. Defaults to 20.")
      .default(20),
    cursor: z
      .string()
      .min(1)
      .optional()
      .describe("Opaque pagination cursor from a previous list_workflow_runs response."),
    workflowId: z.cuid2().optional().describe("Return only runs of this workflow."),
    responseId: z.cuid2().optional().describe("Return only runs triggered by this survey response."),
    filter: z
      .strictObject({
        status: z
          .strictObject({
            in: lengthBoundedArray(ZWorkflowRunStatus, {
              min: 1,
              max: MCP_MAX_FILTER_VALUES,
              description: "Run statuses to include, for example queued or completed.",
            }).optional(),
          })
          .describe("Filter by run status.")
          .optional(),
        isDryRun: z.boolean().optional().describe("Filter by dry-run vs real runs. Omit to return both."),
      })
      .describe("Optional supported v3 workflow run filters.")
      .optional(),
  })
  .strict();
export type TMcpListWorkflowRunsInput = z.infer<typeof ZMcpListWorkflowRunsInput>;

export const ZMcpGetWorkflowRunInput = z
  .object({
    runId: z.cuid2().describe("Workflow run ID to fetch, including its ordered step logs."),
  })
  .strict();
export type TMcpGetWorkflowRunInput = z.infer<typeof ZMcpGetWorkflowRunInput>;

export const ZMcpTestWorkflowInput = z
  .object({
    workflowId: z.cuid2().describe("Workflow ID to dry-run (validate + mock execute, no side effects)."),
  })
  .strict();
export type TMcpTestWorkflowInput = z.infer<typeof ZMcpTestWorkflowInput>;

// --- Mutations ---

// The v3 create contract with the strict definition: workspaceId, name, optional description, and the
// full workflow definition graph. Workflows are always created as drafts (enable makes them live).
//
// No `.strict()` here, unlike its siblings: `ZCreateWorkflowInputStrict` is already a `z.strictObject`, so it
// would add nothing - and Zod 4's `.strict()` returns a clone that drops `.describe()`, which would
// silently strip the contract's own "Creates a draft workflow." description from what `tools/list`
// advertises.
export const ZMcpCreateWorkflowInput = ZCreateWorkflowInputStrict;
export type TMcpCreateWorkflowInput = z.infer<typeof ZMcpCreateWorkflowInput>;

export const ZMcpPatchWorkflowInput = z
  .object({
    workflowId: z.cuid2().describe("Workflow ID to update."),
    data: ZPatchWorkflowInputStrict.describe(
      "Partial update. Provided top-level fields replace that whole subtree; definition edits are only accepted while draft or disabled."
    ),
  })
  .strict();
export type TMcpPatchWorkflowInput = z.infer<typeof ZMcpPatchWorkflowInput>;

export const ZMcpDuplicateWorkflowInput = z
  .object({
    workflowId: z.cuid2().describe("Workflow ID to duplicate as a new draft."),
    name: z
      .string()
      .min(1)
      .max(120)
      .optional()
      .describe("Optional name for the copy. If omitted, the server picks a non-conflicting name."),
  })
  .strict();
export type TMcpDuplicateWorkflowInput = z.infer<typeof ZMcpDuplicateWorkflowInput>;

// Shared shape for the id-only lifecycle mutations (delete / enable / disable / archive / unarchive).
export const ZMcpWorkflowIdInput = z
  .object({
    workflowId: z.cuid2().describe("Workflow ID."),
  })
  .strict();
export type TMcpWorkflowIdInput = z.infer<typeof ZMcpWorkflowIdInput>;

export const ZMcpDeleteWorkflowInput = ZMcpWorkflowIdInput.extend({ confirm: confirmArgument }).strict();
export type TMcpDeleteWorkflowInput = z.infer<typeof ZMcpDeleteWorkflowInput>;
