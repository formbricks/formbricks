import { z } from "zod";

/**
 * A workflow keeps one Sample payload per source (ADR 0048): `trigger` for the Webhook trigger's last
 * payload, or an HTTP request step id for that step's last Test request response.
 */
export const WORKFLOW_SAMPLE_TRIGGER_SOURCE = "trigger";

/** What a `WorkflowSample` row stores: always a JSON object. */
export const ZWorkflowSampleData = z.record(z.string(), z.unknown());
export type TWorkflowSampleData = z.infer<typeof ZWorkflowSampleData>;
