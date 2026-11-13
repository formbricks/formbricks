import { z } from "zod";
import { WORKFLOW_ACTIONS } from "./enum";
import { ZWorkflowHttpRequestActionConfig, ZWorkflowHttpRequestActionNode } from "./http-request";
import { ZWorkflowSendEmailActionConfig, ZWorkflowSendEmailActionNode } from "./send-email";

export * from "./enum";
export * from "./send-email";
export * from "./http-request";

export const WORKFLOW_ACTION_CONFIG_SCHEMAS = {
  [WORKFLOW_ACTIONS.SEND_EMAIL]: ZWorkflowSendEmailActionConfig,
  [WORKFLOW_ACTIONS.HTTP_REQUEST]: ZWorkflowHttpRequestActionConfig,
} as const;

type TWorkflowActionConfigSchema =
  (typeof WORKFLOW_ACTION_CONFIG_SCHEMAS)[keyof typeof WORKFLOW_ACTION_CONFIG_SCHEMAS];

export type TWorkflowActionConfig = z.infer<TWorkflowActionConfigSchema>;

export const ZWorkflowActionNode = z.discriminatedUnion("actionType", [
  ZWorkflowSendEmailActionNode,
  ZWorkflowHttpRequestActionNode,
]);
export type TWorkflowActionNode = z.infer<typeof ZWorkflowActionNode>;
