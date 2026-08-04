import { z } from "zod";

export const WORKFLOW_TRIGGERS = {
  RESPONSE_COMPLETED: "response.completed",
} as const;

export const ZWorkflowTriggerType = z.enum(Object.values(WORKFLOW_TRIGGERS));
export type TWorkflowTriggerType = z.infer<typeof ZWorkflowTriggerType>;
