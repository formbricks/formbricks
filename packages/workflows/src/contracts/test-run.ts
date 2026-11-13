import { z } from "zod";
import { ZWorkflowWebhookPayload } from "../types/triggers/webhook";
import { WEBHOOK_PAYLOAD_MAX_BYTES, WEBHOOK_PAYLOAD_MAX_DEPTH } from "../webhook/limits";

/**
 * Contracts for a Test run (ENG-7181, ADR 0049): the workflow's draft runs at once, inside the
 * request, with fake effects. Nothing is sent or called, the run is saved with `isDryRun = true` and
 * no version, and it is never billed. The answer is the run itself (`ZWorkflowRunResource`).
 */
export const ZCreateWorkflowTestRunInput = z
  .strictObject({
    payload: ZWorkflowWebhookPayload.optional().describe(
      `The test payload: a JSON object of at most ${WEBHOOK_PAYLOAD_MAX_BYTES / 1024} KB, nested at most ${WEBHOOK_PAYLOAD_MAX_DEPTH} levels. Defaults to the workflow's Sample payload.`
    ),
  })
  .describe("Starts a Test run of the workflow's draft.");
export type TCreateWorkflowTestRunInput = z.infer<typeof ZCreateWorkflowTestRunInput>;
