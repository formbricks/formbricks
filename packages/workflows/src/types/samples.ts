import { z } from "zod";

/**
 * A workflow keeps one sample per source (ADR 0048, ADR 0052, ADR 0054): `trigger` for the Webhook
 * trigger's expected payload, which only editors set (calls never change it); `trigger_last_call` for
 * the last payload a call to the Secret URL sent, with its time and IP; an HTTP request step id for
 * that step's expected response body, which only editors set (Test requests never change it); and
 * `<step id>:last_test` for that step's last Test request response.
 */
export const WORKFLOW_SAMPLE_TRIGGER_SOURCE = "trigger";
export const WORKFLOW_SAMPLE_LAST_CALL_SOURCE = "trigger_last_call";

/** Sources that hold Webhook trigger data rather than an HTTP request step's Test request response. */
export const WORKFLOW_TRIGGER_SAMPLE_SOURCES = [
  WORKFLOW_SAMPLE_TRIGGER_SOURCE,
  WORKFLOW_SAMPLE_LAST_CALL_SOURCE,
] as const;

/** Ends the source of an HTTP request step's last Test request response (ADR 0054). */
export const WORKFLOW_SAMPLE_LAST_TEST_SUFFIX = ":last_test";

/** The source of an HTTP request step's last Test request response. */
export const getLastTestSampleSource = (stepId: string): string =>
  `${stepId}${WORKFLOW_SAMPLE_LAST_TEST_SUFFIX}`;

/** Whether a source holds a step's last Test request response rather than its expected response body. */
export const isLastTestSampleSource = (source: string): boolean =>
  source.endsWith(WORKFLOW_SAMPLE_LAST_TEST_SUFFIX);

/** What a `WorkflowSample` row stores: always a JSON object. */
export const ZWorkflowSampleData = z.record(z.string(), z.unknown());
export type TWorkflowSampleData = z.infer<typeof ZWorkflowSampleData>;
