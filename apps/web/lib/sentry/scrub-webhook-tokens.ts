import { redactWebhookTokens } from "@/lib/utils/redact-webhook-token";

/** Containers deeper than this are left as they are; Sentry events are shallow in practice. */
const MAX_SCRUB_DEPTH = 32;

const scrubValue = (value: unknown, depth: number): unknown => {
  if (typeof value === "string") return redactWebhookTokens(value);
  if (depth >= MAX_SCRUB_DEPTH || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));

  const scrubbed: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    scrubbed[key] = scrubValue(entry, depth + 1);
  }
  return scrubbed;
};

/**
 * `beforeSend` step that removes Webhook Secret URL tokens (ADR 0041) from a Sentry event: the request
 * URL and headers, the transaction name, exception messages, breadcrumbs, tags and contexts. Every string
 * is checked rather than a list of known fields, because the SDK and Next.js add the request path to
 * more places than one would list.
 */
export const scrubWebhookTokens = <TEvent extends object>(event: TEvent): TEvent =>
  scrubValue(event, 0) as TEvent;
