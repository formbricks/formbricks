import { z } from "zod";
import { ZWorkflowResource, ZWorkflowRunListItem } from "@formbricks/workflows";
import { ZMcpToolError } from "../../tools/output-schemas";

/**
 * What `show_workflow` answers with, built from the v3 workflow and run-list resource schemas and never
 * retyped (the SDK fails every call whose result drifts from this).
 *
 * Not `mcpToolOutput(...)`: that envelope is `{ data, meta }` for one operation's body, and this tool
 * joins two (the workflow and its latest runs). The root is still one object with every branch optional,
 * for the reason `mcpToolOutput` documents, and the error branch is the shared one.
 */
export const ZMcpShowWorkflowOutput = z
  .object({
    workflow: ZWorkflowResource.optional(),
    recentRuns: z
      .array(ZWorkflowRunListItem)
      .optional()
      .describe(
        "The workflow's most recent runs, newest first. Empty when it has none or they were unavailable."
      ),
    recentRunsError: z
      .string()
      .optional()
      .describe("Why the recent runs could not be loaded. The workflow itself is still complete."),
    requestId: z.string().optional(),
    error: ZMcpToolError.optional(),
  })
  .strict();
export type TMcpShowWorkflowOutput = z.infer<typeof ZMcpShowWorkflowOutput>;
