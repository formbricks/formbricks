import { z } from "zod";
import { ZCreateWorkflowTestRunInput } from "@formbricks/workflows";

export const ZMcpRunTestInput = ZCreateWorkflowTestRunInput.extend({
  workflowId: z.cuid2().describe("Workflow ID. The workflow must have a Webhook trigger."),
})
  .strict()
  .describe("Start a Test run of a Webhook workflow's draft: nothing is sent or called.");
export type TMcpRunTestInput = z.infer<typeof ZMcpRunTestInput>;
