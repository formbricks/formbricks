import type { AttributeValue, Attributes } from "@opentelemetry/api";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import { redactWebhookTokens } from "./redact-webhook-token";

const redactValue = (value: AttributeValue | undefined): AttributeValue | undefined => {
  if (typeof value === "string") return redactWebhookTokens(value);
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "string" ? redactWebhookTokens(item) : item
    ) as AttributeValue;
  }
  return value;
};

const redactAttributes = (attributes: Attributes): Attributes => {
  const redacted: Attributes = {};
  for (const [key, value] of Object.entries(attributes)) redacted[key] = redactValue(value);
  return redacted;
};

/**
 * Wraps the span in an object that reads everything else (span context, timing, resource) from the
 * original, so the exporter sees a complete span with only the text fields replaced.
 */
const redactSpan = (span: ReadableSpan): ReadableSpan =>
  Object.create(span, {
    name: { value: redactWebhookTokens(span.name), enumerable: true },
    attributes: { value: redactAttributes(span.attributes), enumerable: true },
    events: {
      value: span.events.map((event) => ({
        ...event,
        name: redactWebhookTokens(event.name),
        attributes: event.attributes && redactAttributes(event.attributes),
      })),
      enumerable: true,
    },
    status: {
      value: {
        ...span.status,
        message: span.status.message && redactWebhookTokens(span.status.message),
      },
      enumerable: true,
    },
  }) as ReadableSpan;

/**
 * A trace exporter that removes Webhook Secret URL tokens (ADR 0057) before spans leave the process.
 * The HTTP and Next.js instrumentations put the raw request URL in span names and attributes
 * (`url.full`, `http.target`, …), so every text field is checked rather than a list of known keys.
 */
export const createWebhookTokenRedactingExporter = (exporter: SpanExporter): SpanExporter => ({
  export: (spans, resultCallback) => exporter.export(spans.map(redactSpan), resultCallback),
  shutdown: () => exporter.shutdown(),
  forceFlush: async () => {
    await exporter.forceFlush?.();
  },
});
