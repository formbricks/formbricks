import { z } from "zod";
import { WORKFLOW_TRIGGERS } from "./enum";
import { ZResponseCompletedTriggerConfig, ZWorkflowResponseCompletedTriggerNode } from "./response-completed";

export * from "./enum";
export * from "./response-completed";

const WORKFLOW_TRIGGER_CONFIG_SCHEMAS = {
  [WORKFLOW_TRIGGERS.RESPONSE_COMPLETED]: ZResponseCompletedTriggerConfig,
} as const;

type TWorkflowTriggerConfigSchema =
  (typeof WORKFLOW_TRIGGER_CONFIG_SCHEMAS)[keyof typeof WORKFLOW_TRIGGER_CONFIG_SCHEMAS];
export type TWorkflowTriggerConfig = z.infer<TWorkflowTriggerConfigSchema>;

export const ZWorkflowTriggerNode = z.discriminatedUnion("triggerType", [
  ZWorkflowResponseCompletedTriggerNode,
]);
export type TWorkflowTriggerNode = z.infer<typeof ZWorkflowTriggerNode>;
