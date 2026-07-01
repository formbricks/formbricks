import { z } from "zod";
import { ZWorkflowRunStatus, ZWorkflowSortBy, ZWorkflowStatus } from "@formbricks/workflows";

export const ZMcpListWorkflowsInput = z.object({
  workspaceId: z.cuid2().describe("Workspace ID whose workflows should be listed."),
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
    .object({
      name: z
        .object({
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
        .object({
          in: z
            .array(ZWorkflowStatus)
            .min(1)
            .optional()
            .describe("Workflow statuses to include. Omitting returns every status except archived."),
        })
        .describe("Filter by workflow status.")
        .optional(),
    })
    .describe("Optional supported v3 workflow filters.")
    .optional(),
  sortBy: ZWorkflowSortBy.optional().describe(
    "Sort field for pagination. Defaults to the v3 API default of updatedAt."
  ),
});
export type TMcpListWorkflowsInput = z.infer<typeof ZMcpListWorkflowsInput>;

export const ZMcpGetWorkflowInput = z.object({
  workflowId: z.cuid2().describe("Workflow ID to fetch."),
});
export type TMcpGetWorkflowInput = z.infer<typeof ZMcpGetWorkflowInput>;

export const ZMcpListWorkflowRunsInput = z.object({
  workspaceId: z.cuid2().describe("Workspace ID whose workflow runs should be listed."),
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
    .object({
      status: z
        .object({
          in: z
            .array(ZWorkflowRunStatus)
            .min(1)
            .optional()
            .describe("Run statuses to include, for example queued or completed."),
        })
        .describe("Filter by run status.")
        .optional(),
      isDryRun: z.boolean().optional().describe("Filter by dry-run vs real runs. Omit to return both."),
    })
    .describe("Optional supported v3 workflow run filters.")
    .optional(),
});
export type TMcpListWorkflowRunsInput = z.infer<typeof ZMcpListWorkflowRunsInput>;

export const ZMcpGetWorkflowRunInput = z.object({
  runId: z.cuid2().describe("Workflow run ID to fetch, including its ordered step logs."),
});
export type TMcpGetWorkflowRunInput = z.infer<typeof ZMcpGetWorkflowRunInput>;

export const ZMcpTestWorkflowInput = z.object({
  workflowId: z.cuid2().describe("Workflow ID to dry-run (validate + mock execute, no side effects)."),
});
export type TMcpTestWorkflowInput = z.infer<typeof ZMcpTestWorkflowInput>;
