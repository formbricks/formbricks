import { z } from "zod";
import { ZCreateWorkflowTestRunInput } from "@formbricks/workflows";

export const ZMcpRunTestInput = ZCreateWorkflowTestRunInput.extend({
  workflowId: z
    .cuid2()
    .describe("Workflow ID. The workflow must have a Webhook or Response completed trigger."),
})
  .strict()
  .describe("Start a Test run of a workflow's draft: nothing is sent or called.");
export type TMcpRunTestInput = z.infer<typeof ZMcpRunTestInput>;
