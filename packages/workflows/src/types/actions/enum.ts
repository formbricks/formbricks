import { z } from "zod";

export const WORKFLOW_ACTIONS = {
  SEND_EMAIL: "send_email",
} as const;

export const ZWorkflowActionType = z.enum(Object.values(WORKFLOW_ACTIONS));
export type TWorkflowActionType = z.infer<typeof ZWorkflowActionType>;
