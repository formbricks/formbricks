import { z } from "zod";
import { ZWorkflowSampleData } from "../types/samples";
import { ZIsoDateTime } from "./common";

/**
 * Contract for reading a workflow's samples (ADR 0048, ADR 0054): the Webhook trigger's expected
 * payload (`trigger`), each HTTP request step's expected response body (the step id), and each step's last
 * Test request response (`<step id>:last_test`). The editor reads a step's expected response body for its
 * Variables, and offers its last Test request response to use instead.
 */

export const ZWorkflowSampleListItem = z
  .object({
    source: z
      .string()
      .min(1)
      .describe(
        "`trigger` for the Webhook trigger's expected payload, an HTTP request step's id for its expected response body, or `<step id>:last_test` for its last Test request response."
      ),
    sample: ZWorkflowSampleData.describe(
      "The sample: a payload for `trigger`; for a step, a response ({status, contentType, body, bodyTruncated?})."
    ),
    updatedAt: ZIsoDateTime,
  })
  .describe("One of a workflow's samples.");
export type TWorkflowSampleListItem = z.infer<typeof ZWorkflowSampleListItem>;

export const ZWorkflowSampleList = z
  .array(ZWorkflowSampleListItem)
  .describe("The workflow's samples, one per source.");
export type TWorkflowSampleList = z.infer<typeof ZWorkflowSampleList>;
