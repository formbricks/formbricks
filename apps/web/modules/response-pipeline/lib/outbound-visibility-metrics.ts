import { type Counter, metrics } from "@opentelemetry/api";

/**
 * ENG-3283: outbound work skipped because its survey is not workspace-visible. `kind` is one of a fixed
 * set, never an id, so the series stays bounded.
 */
export type TSurveyOutboundKind = "webhook" | "integration" | "feedback_source" | "follow_up" | "workflow";

let counter: Counter | undefined;

// A no-op until `instrumentation-node.ts` registers the SDK's provider, so recording is always safe.
const getCounter = (): Counter => {
  counter ??= metrics.getMeter("formbricks.surveys").createCounter("formbricks.survey.outbound.skipped", {
    description: "Outbound deliveries skipped because the survey is not visible to the whole workspace",
    unit: "{delivery}",
  });
  return counter;
};

export const recordSurveyOutboundSkipped = (kind: TSurveyOutboundKind, count = 1): void => {
  if (count > 0) getCounter().add(count, { kind });
};
