import { z } from "zod";
import { ZWorkflowNodeBase } from "../common";
import { WORKFLOW_ACTIONS } from "./enum";

export const ZWorkflowSendEmailActionConfig = z.object({
  to: z.string(),
  from: z.email(),
  replyTo: z.array(z.email()),
  subject: z.string(),
  body: z.string(),
  attachResponseData: z.boolean(),
  includeVariables: z.boolean().optional(),
  includeHiddenFields: z.boolean().optional(),
});

export type TWorkflowSendEmailActionConfig = z.infer<typeof ZWorkflowSendEmailActionConfig>;

export const ZWorkflowSendEmailActionNode = ZWorkflowNodeBase.extend({
  type: z.literal("action"),
  actionType: z.literal(WORKFLOW_ACTIONS.SEND_EMAIL),
  config: ZWorkflowSendEmailActionConfig,
});

export type TWorkflowSendEmailActionNode = z.infer<typeof ZWorkflowSendEmailActionNode>;
