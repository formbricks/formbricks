import { z } from "zod";
import { ZWorkflowSampleData } from "../types/samples";
import { ZIsoDateTime } from "./common";

/**
 * Contract for reading a workflow's samples (ADR 0048): the Webhook trigger's Sample payload
 * (`trigger`) and each HTTP request step's last Test request response (the step id). The editor reads
 * the step samples to offer an HTTP request's response fields as Variables after a Send test request.
 */

export const ZWorkflowSampleListItem = z
  .object({
    source: z
      .string()
      .min(1)
      .describe("`trigger` for the Webhook trigger's Sample payload, or an HTTP request step's id."),
    sample: ZWorkflowSampleData.describe(
      "The sample: a payload for `trigger`; for a step, its last Test request response ({status, contentType, body, bodyTruncated?})."
    ),
    updatedAt: ZIsoDateTime,
  })
  .describe("One of a workflow's samples.");
export type TWorkflowSampleListItem = z.infer<typeof ZWorkflowSampleListItem>;

export const ZWorkflowSampleList = z
  .array(ZWorkflowSampleListItem)
  .describe("The workflow's samples, one per source.");
export type TWorkflowSampleList = z.infer<typeof ZWorkflowSampleList>;
