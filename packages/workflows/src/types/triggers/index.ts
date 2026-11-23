import { z } from "zod";
import { WORKFLOW_TRIGGERS } from "./enum";
import {
  ZResponseCompletedTriggerConfig,
  ZWorkflowResponseCompletedTriggerNode,
  ZWorkflowResponseCompletedTriggerPayload,
} from "./response-completed";
import {
  ZWebhookTriggerConfig,
  ZWorkflowWebhookTriggerNode,
  ZWorkflowWebhookTriggerPayload,
} from "./webhook";

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

/** Narrows a trigger to Response completed, the only trigger type bound to a survey. */
export const isResponseCompletedTrigger = (
  trigger: TWorkflowTriggerNode | null | undefined
): trigger is z.infer<typeof ZWorkflowResponseCompletedTriggerNode> =>
  trigger?.triggerType === WORKFLOW_TRIGGERS.RESPONSE_COMPLETED;

/** The survey a trigger is bound to: a Response completed trigger's survey, otherwise null. */
export const getTriggerSurveyId = (trigger: TWorkflowTriggerNode | null | undefined): string | null =>
  isResponseCompletedTrigger(trigger) ? trigger.config.surveyId : null;

/** The ending cards a Response completed trigger fires on; undefined for any other trigger. */
export const getTriggerEndingCardIds = (
  trigger: TWorkflowTriggerNode | null | undefined
): string[] | undefined => (isResponseCompletedTrigger(trigger) ? trigger.config.endingCardIds : undefined);

/**
 * What a trigger captured when it fired, discriminated by `type` (the trigger type). A union so each
 * trigger brings its own shape: the Webhook trigger (ENG-7177) adds its member here and in
 * `ZWorkflowTriggerRunPayload`, and its payload becomes the run context's `payload` source (ADR 0045).
 */
export const ZWorkflowTriggerPayload = z
  .discriminatedUnion("type", [ZWorkflowResponseCompletedTriggerPayload, ZWorkflowWebhookTriggerPayload])
  .describe("Runtime payload captured when a workflow trigger fires.");
export type TWorkflowTriggerPayload = z.infer<typeof ZWorkflowTriggerPayload>;
