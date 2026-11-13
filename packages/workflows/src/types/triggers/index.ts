import { z } from "zod";
import { WORKFLOW_TRIGGERS } from "./enum";
import { ZResponseCompletedTriggerConfig, ZWorkflowResponseCompletedTriggerNode } from "./response-completed";
import { ZWebhookTriggerConfig, ZWorkflowWebhookTriggerNode } from "./webhook";

export * from "./enum";
export * from "./response-completed";
export * from "./webhook";

interface TWorkflowTriggerConfigSchemas {
  [WORKFLOW_TRIGGERS.RESPONSE_COMPLETED]: typeof ZResponseCompletedTriggerConfig;
  [WORKFLOW_TRIGGERS.WEBHOOK]: typeof ZWebhookTriggerConfig;
}

type TWorkflowTriggerConfigSchema = TWorkflowTriggerConfigSchemas[keyof TWorkflowTriggerConfigSchemas];
export type TWorkflowTriggerConfig = z.infer<TWorkflowTriggerConfigSchema>;

export const ZWorkflowTriggerNode = z.discriminatedUnion("triggerType", [
  ZWorkflowResponseCompletedTriggerNode,
  ZWorkflowWebhookTriggerNode,
]);
export type TWorkflowTriggerNode = z.infer<typeof ZWorkflowTriggerNode>;
