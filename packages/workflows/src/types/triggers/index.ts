import { z } from "zod";
import { WORKFLOW_TRIGGERS } from "./enum";
import { ZResponseCompletedTriggerConfig, ZWorkflowResponseCompletedTriggerNode } from "./response-completed";

export * from "./enum";
export * from "./response-completed";

interface TWorkflowTriggerConfigSchemas {
  [WORKFLOW_TRIGGERS.RESPONSE_COMPLETED]: typeof ZResponseCompletedTriggerConfig;
}

type TWorkflowTriggerConfigSchema = TWorkflowTriggerConfigSchemas[keyof TWorkflowTriggerConfigSchemas];
export type TWorkflowTriggerConfig = z.infer<TWorkflowTriggerConfigSchema>;

export const ZWorkflowTriggerNode = z.discriminatedUnion("triggerType", [
  ZWorkflowResponseCompletedTriggerNode,
]);
export type TWorkflowTriggerNode = z.infer<typeof ZWorkflowTriggerNode>;
