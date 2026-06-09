import z from "zod";
import { ZWorkflowNodeBase } from "../common";
import { WORKFLOW_ACTIONS } from "./enum";
import { ZWorkflowSendEmailActionConfig } from "./send-email";

export * from "./enum";
export * from "./send-email";

export const WORKFLOW_ACTION_CONFIG_SCHEMAS = {
  [WORKFLOW_ACTIONS.SEND_EMAIL]: ZWorkflowSendEmailActionConfig,
} as const;

type TWorkflowActionConfigSchema =
  (typeof WORKFLOW_ACTION_CONFIG_SCHEMAS)[keyof typeof WORKFLOW_ACTION_CONFIG_SCHEMAS];
export type TWorkflowActionConfig = z.infer<TWorkflowActionConfigSchema>;

export const ZWorkflowSendEmailActionNode = ZWorkflowNodeBase.extend({
  type: z.literal("action"),
  actionType: z.literal(WORKFLOW_ACTIONS.SEND_EMAIL),
  config: ZWorkflowSendEmailActionConfig,
});
export type TWorkflowSendEmailActionNode = z.infer<typeof ZWorkflowSendEmailActionNode>;

export const ZWorkflowActionNode = z.discriminatedUnion("actionType", [ZWorkflowSendEmailActionNode]);
export type TWorkflowActionNode = z.infer<typeof ZWorkflowActionNode>;
