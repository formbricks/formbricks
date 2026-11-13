import { z } from "zod";
import { ZSetWorkflowSampleInput } from "@formbricks/workflows";

export const ZMcpSetSamplePayloadInput = ZSetWorkflowSampleInput.extend({
  workflowId: z.cuid2().describe("Workflow ID. The workflow must have a Webhook trigger."),
})
  .strict()
  .describe("Replace a Webhook workflow's Sample payload.");
export type TMcpSetSamplePayloadInput = z.infer<typeof ZMcpSetSamplePayloadInput>;
