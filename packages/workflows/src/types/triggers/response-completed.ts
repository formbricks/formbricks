import { z } from "zod";
import { WORKFLOW_TRIGGERS } from "./enum";

export const ZResponseCompletedTriggerConfig = z.object({
  surveyId: z.cuid2(),
  endingCardIds: z.array(z.cuid2()).default([]),
});
export type TResponseCompletedTriggerConfig = z.infer<typeof ZResponseCompletedTriggerConfig>;

export const ZWorkflowTriggerPayload = z
  .object({
    type: z.literal(WORKFLOW_TRIGGERS.RESPONSE_COMPLETED),
    surveyId: z.cuid2().optional(),
    responseId: z.cuid2().optional(),
    endingCardId: z.cuid2().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .catchall(z.unknown());
export type TWorkflowTriggerPayload = z.infer<typeof ZWorkflowTriggerPayload>;
