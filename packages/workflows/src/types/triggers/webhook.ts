import { z } from "zod";
import { ZWorkflowNodeBase } from "../common";
import { WORKFLOW_TRIGGERS } from "./enum";

/**
 * A Webhook trigger has nothing to configure: its Webhook Secret URL token lives on the `Workflow`
 * row (hash + encrypted copy), never in the definition, because the definition is copied into every
 * version, duplicate and audit snapshot (ADR 0048). Strict so a token pasted here is refused.
 *
 * Typed as an object with no keys rather than Zod's inferred `Record<string, never>`: under the
 * latter, `trigger.config.surveyId` type-checks as `never` on a trigger of either type, so code that
 * forgets to narrow on `triggerType` compiles and then reads `undefined` at runtime.
 */
export const ZWebhookTriggerConfig: z.ZodType<Record<never, never>> = z.strictObject({});
export type TWebhookTriggerConfig = z.infer<typeof ZWebhookTriggerConfig>;

export const ZWorkflowWebhookTriggerNode = ZWorkflowNodeBase.extend({
  type: z.literal("trigger"),
  triggerType: z.literal(WORKFLOW_TRIGGERS.WEBHOOK),
  config: ZWebhookTriggerConfig.default({}),
});
export type TWorkflowWebhookTriggerNode = z.infer<typeof ZWorkflowWebhookTriggerNode>;

/** The JSON object a Webhook Secret URL call delivered (the Payload). */
export const ZWorkflowWebhookPayload = z.record(z.string(), z.unknown());
export type TWorkflowWebhookPayload = z.infer<typeof ZWorkflowWebhookPayload>;

export const ZWorkflowWebhookTriggerPayload = z
  .object({
    type: z.literal(WORKFLOW_TRIGGERS.WEBHOOK),
    workspaceId: z.cuid2(),
    payload: ZWorkflowWebhookPayload,
  })
  .describe("Runtime payload captured when a Webhook Secret URL call starts a run.");
export type TWorkflowWebhookTriggerPayload = z.infer<typeof ZWorkflowWebhookTriggerPayload>;
