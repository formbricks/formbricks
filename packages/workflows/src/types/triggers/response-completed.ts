import { z } from "zod";
import { ZWorkflowNodeBase } from "../common";
import { WORKFLOW_TRIGGERS } from "./enum";

export const ZResponseCompletedTriggerConfig = z.object({
  surveyId: z.cuid2(),
  endingCardIds: z
    .array(z.cuid2())
    .default([])
    .describe("Ending card ids that should trigger the workflow. Empty means all endings."),
});
export type TResponseCompletedTriggerConfig = z.infer<typeof ZResponseCompletedTriggerConfig>;

export const ZWorkflowTriggerPayload = z
  .object({
    type: z.literal(WORKFLOW_TRIGGERS.RESPONSE_COMPLETED),
    workspaceId: z.cuid2(),
    surveyId: z.cuid2(),
    responseId: z.cuid2(),
    endingCardId: z.cuid2().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .catchall(z.unknown())
  .describe("Runtime payload captured when a workflow trigger fires.");
export type TWorkflowTriggerPayload = z.infer<typeof ZWorkflowTriggerPayload>;

export const ZWorkflowResponseCompletedTriggerNode = ZWorkflowNodeBase.extend({
  type: z.literal("trigger"),
  triggerType: z.literal(WORKFLOW_TRIGGERS.RESPONSE_COMPLETED),
  config: ZResponseCompletedTriggerConfig,
});
export type TWorkflowResponseCompletedTriggerNode = z.infer<typeof ZWorkflowResponseCompletedTriggerNode>;
