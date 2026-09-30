import { type Attributes, type Counter, type Histogram, metrics } from "@opentelemetry/api";
import type { TResponsePipelineEvent } from "@formbricks/jobs";

/**
 * What a single delivery attempt ended as. `retryable_failure` is one attempt that BullMQ will (or, on
 * the last attempt, would) retry; `permanent_failure` is a rejection no retry can fix; `load_failed` is our
 * own database refusing to hand over the webhook, so no request was made and the fault is ours rather than
 * the receiver's; the two `skipped_*` outcomes are completions with no HTTP request at all.
 */
export type TWebhookDeliveryOutcome =
  | "delivered"
  | "retryable_failure"
  | "permanent_failure"
  | "load_failed"
  | "skipped_deleted"
  | "skipped_rescoped";

/**
 * Metric attributes are deliberately low-cardinality: outcome, event and the status class — never a
 * workspace, webhook or response id (each would be an unbounded time series).
 */
export interface TWebhookDeliveryMetricSample {
  outcome: TWebhookDeliveryOutcome;
  event: TResponsePipelineEvent;
  statusCode?: number;
  /** Wall-clock time of the HTTP exchange; omitted when no request was made. */
  durationMs?: number;
}

const WEBHOOK_METER_NAME = "formbricks.webhooks";

interface TWebhookDeliveryInstruments {
  counter: Counter;
  duration: Histogram;
}

let instruments: TWebhookDeliveryInstruments | undefined;

// `metrics.getMeter()` hands back a proxy that binds to the SDK's provider once `instrumentation-node.ts`
// has registered it and stays a no-op otherwise, so recording is safe with metrics export disabled.
const getInstruments = (): TWebhookDeliveryInstruments => {
  if (!instruments) {
    const meter = metrics.getMeter(WEBHOOK_METER_NAME);
    instruments = {
      counter: meter.createCounter("formbricks.webhook.delivery.total", {
        description: "Webhook delivery attempts by outcome",
        unit: "{attempt}",
      }),
      duration: meter.createHistogram("formbricks.webhook.delivery.duration", {
        description: "Wall-clock duration of the webhook HTTP exchange",
        unit: "ms",
      }),
    };
  }
  return instruments;
};

const toStatusClass = (statusCode: number | undefined): string | undefined =>
  statusCode === undefined ? undefined : `${Math.floor(statusCode / 100)}xx`;

export const recordWebhookDeliveryOutcome = ({
  outcome,
  event,
  statusCode,
  durationMs,
}: TWebhookDeliveryMetricSample): void => {
  const attributes: Attributes = { outcome, event };
  const statusClass = toStatusClass(statusCode);
  if (statusClass) {
    attributes.status_class = statusClass;
  }

  const { counter, duration } = getInstruments();
  counter.add(1, attributes);
  if (durationMs !== undefined) {
    duration.record(durationMs, attributes);
  }
};
