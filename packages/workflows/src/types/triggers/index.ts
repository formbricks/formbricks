import { z } from "zod";
import { WORKFLOW_TRIGGERS } from "./enum";
import {
  ZResponseCompletedTriggerConfig,
  ZWorkflowResponseCompletedTriggerNode,
  ZWorkflowResponseCompletedTriggerPayload,
} from "./response-completed";

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

/**
 * What a trigger captured when it fired, discriminated by `type` (the trigger type). A union so each
 * trigger brings its own shape: the Webhook trigger (ENG-7177) adds its member here and in
 * `ZWorkflowTriggerRunPayload`, and its payload becomes the run context's `payload` source (ADR 0045).
 */
export const ZWorkflowTriggerPayload = z
  .discriminatedUnion("type", [ZWorkflowResponseCompletedTriggerPayload])
  .describe("Runtime payload captured when a workflow trigger fires.");
export type TWorkflowTriggerPayload = z.infer<typeof ZWorkflowTriggerPayload>;
