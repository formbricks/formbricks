import { z } from "zod";
import { WORKFLOW_SAMPLE_TRIGGER_SOURCE } from "../types/samples";
import { ZWorkflowWebhookPayload } from "../types/triggers/webhook";
import { WEBHOOK_PAYLOAD_MAX_BYTES, WEBHOOK_PAYLOAD_MAX_DEPTH } from "../webhook/limits";
import { ZIsoDateTime } from "./common";

/**
 * Contracts for the Webhook trigger operations (ENG-7177): reading and regenerating a workflow's
 * Webhook Secret URL, setting its Sample payload, and the public call that starts runs.
 */

export const ZWorkflowSampleVariables = z
  .object({
    variables: z
      .array(
        z.object({
          path: z.string().min(1).describe("Variable path, e.g. payload.customer.email."),
          valueType: z.enum(["object", "string", "number", "boolean", "null"]),
        })
      )
      .describe("Variables the Sample payload offers, in document order."),
    notSupported: z
      .array(
        z.object({
          path: z.string().min(1),
          reason: z
            .enum(["list", "unsafe_segment", "unreachable_key"])
            .describe(
              "list: lists are not supported yet; unsafe_segment: __proto__, prototype or constructor; unreachable_key: a key with characters other than letters, digits, - and _ (a dot or a space, say), which a Variable path cannot carry."
            ),
        })
      )
      .describe("Paths that cannot be used as Variables."),
    truncated: z.boolean().describe("True when only the first 500 paths were read."),
  })
  .describe("Variables detected in a Sample payload.");
export type TWorkflowSampleVariables = z.infer<typeof ZWorkflowSampleVariables>;

export const ZWorkflowSampleResource = z
  .object({
    workflowId: z.cuid2(),
    source: z.literal(WORKFLOW_SAMPLE_TRIGGER_SOURCE),
    payload: ZWorkflowWebhookPayload.describe("The Sample payload: the last one received, or one pasted in."),
    variables: ZWorkflowSampleVariables,
    updatedAt: ZIsoDateTime,
  })
  .describe("A workflow's Sample payload and the Variables it offers.");
export type TWorkflowSampleResource = z.infer<typeof ZWorkflowSampleResource>;

export const ZWorkflowWebhookResource = z
  .object({
    workflowId: z.cuid2(),
    url: z
      .url()
      .describe(
        "The Webhook Secret URL. A credential: anyone holding it can start runs, so treat it like an API key."
      ),
    lastCalledAt: ZIsoDateTime.nullable().describe("When the Secret URL was last called. Null if never."),
    lastCallerIp: z.string().nullable().describe("IP of the last call. Null if never called."),
    sample: ZWorkflowSampleResource.nullable().describe("Null until a call arrives or a sample is set."),
  })
  .describe("A workflow's Webhook Secret URL, its last call, and its Sample payload.");
export type TWorkflowWebhookResource = z.infer<typeof ZWorkflowWebhookResource>;

export const ZSetWorkflowSampleInput = z
  .strictObject({
    payload: ZWorkflowWebhookPayload.describe(
      `A JSON object of at most ${WEBHOOK_PAYLOAD_MAX_BYTES / 1024} KB, nested at most ${WEBHOOK_PAYLOAD_MAX_DEPTH} levels.`
    ),
  })
  .describe("Replaces the workflow's Sample payload, e.g. with one pasted in the editor.");
export type TSetWorkflowSampleInput = z.infer<typeof ZSetWorkflowSampleInput>;

export const ZWorkflowWebhookCallResult = z
  .object({
    runId: z
      .cuid2()
      .nullable()
      .describe(
        "The run the call started, or the one an earlier call with the same Idempotency-Key started. Null when the workflow is a draft or disabled."
      ),
  })
  .describe("Answer to a Webhook Secret URL call.");
export type TWorkflowWebhookCallResult = z.infer<typeof ZWorkflowWebhookCallResult>;

/** Body of a Webhook Secret URL call: any JSON object (size and depth are checked by the route). */
export const ZWorkflowWebhookPayloadInput = ZWorkflowWebhookPayload;

export const ZWorkflowWebhookCallParams = z
  .strictObject({
    workflowId: z.string().min(1),
    token: z.string().min(1),
  })
  .describe("Path of a Webhook Secret URL.");
