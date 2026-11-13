import { z } from "zod";
import { ZWorkflowHttpMethod, ZWorkflowHttpRequestActionConfig } from "../types/actions/http-request";
import { ZWorkflowWebhookPayload } from "../types/triggers/webhook";

/**
 * Contracts for "Send test request" (ENG-7179, ENG-7168): one real call of an HTTP request step from
 * the editor, so the author sees the real response. Not a run: nothing is billed and no later step
 * runs. The response is saved as that step's sample, which "Wait and use it" Variables come from.
 */

export const ZWorkflowTestRequestParams = z
  .object({
    workflowId: z.cuid2(),
    stepId: z.string().min(1).max(200).describe("The HTTP request step's id in the workflow definition."),
  })
  .strict();
export type TWorkflowTestRequestParams = z.infer<typeof ZWorkflowTestRequestParams>;

export const ZSendWorkflowTestRequestInput = z
  .object({
    config: ZWorkflowHttpRequestActionConfig.optional().describe(
      "The step's draft settings; defaults to the saved step. A secret header without a value uses the saved secret of that name; one with a value uses that value for this call only and stores nothing."
    ),
    variables: z
      .object({
        payload: ZWorkflowWebhookPayload.optional().describe(
          "The test payload for payload.<path> Variables; defaults to the workflow's Sample payload."
        ),
        steps: z
          .record(z.string(), z.record(z.string(), z.unknown()))
          .optional()
          .describe(
            "Earlier step outputs for steps.<id>.<path> Variables; defaults to each HTTP request step's last Test request response."
          ),
      })
      .strict()
      .optional(),
  })
  .strict();
export type TSendWorkflowTestRequestInput = z.infer<typeof ZSendWorkflowTestRequestInput>;

export const ZWorkflowTestRequestResult = z
  .object({
    request: z
      .object({
        method: ZWorkflowHttpMethod,
        url: z.string(),
        headers: z
          .array(z.object({ name: z.string(), value: z.string() }))
          .describe("Headers as sent, secret values shown as ••••••."),
        body: z.string().optional(),
        bodyTruncated: z.boolean().optional(),
      })
      .describe("The request that was sent, with secret header values masked."),
    response: z
      .object({
        status: z.number().int(),
        contentType: z.string().nullable(),
        body: z
          .unknown()
          .describe("Parsed JSON when the response is JSON and fits in 64 KB, else up to 64 KB of text."),
        bodyTruncated: z.boolean().optional(),
      })
      .nullable()
      .describe("Null when no answer came (timeout, network error, refused address)."),
    error: z.string().nullable().describe("Why the call got no answer, or null."),
  })
  .describe("The outcome of one Test request. Saved as the step's sample when an answer came.");
export type TWorkflowTestRequestResult = z.infer<typeof ZWorkflowTestRequestResult>;
