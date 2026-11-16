import { z } from "zod";
import { ZSetWorkflowSampleInput } from "@formbricks/workflows";

export const ZMcpSetSamplePayloadInput = ZSetWorkflowSampleInput.extend({
  workflowId: z.cuid2().describe("Workflow ID. The workflow must have a Webhook trigger."),
})
  .strict()
  .describe("Set a Webhook workflow's expected payload.");
export type TMcpSetSamplePayloadInput = z.infer<typeof ZMcpSetSamplePayloadInput>;
