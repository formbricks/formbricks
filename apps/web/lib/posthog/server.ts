import "server-only";
import { type BeforeSendFn, PostHog } from "posthog-node";
import { logger } from "@formbricks/logger";
import { IS_PRODUCTION, POSTHOG_KEY } from "@/lib/constants";

const POSTHOG_HOST = "https://eu.i.posthog.com";

// High-volume paths (one LLM generation or MCP tool call can fire many events
// per request/session) get their own client with real batching, so they can't
// flood PostHog with unbatched requests or affect the low-volume product-event
// client's delivery guarantees. See lib/posthog/ai-tracing.ts and mcp-tracing.ts.
const TRACING_FLUSH_AT = 20;
const TRACING_FLUSH_INTERVAL_MS = 10_000;

/**
 * @posthog/ai's `posthogPrivacyMode` does NOT gate `$ai_error`: on a provider
 * error it stringifies the raw thrown error (including the AI SDK's
 * `APICallError.requestBodyValues`/`responseBody`, i.e. the full prompt and
 * provider response) with no redaction, regardless of privacy mode. That is a
 * client-level bug we can't fix upstream, so strip it here instead - this is
 * the one place both AI and MCP tracing events funnel through. `$ai_is_error`
 * (a plain boolean) is untouched, so the failure-rate metric still works.
 */
const stripAiError: BeforeSendFn = (event) => {
  if (event?.properties && "$ai_error" in event.properties) {
    delete event.properties.$ai_error;
  }
  return event;
};

const globalForPostHog = globalThis as unknown as {
  posthogServerClient: PostHog | undefined;
  posthogTracingClient: PostHog | undefined;
  posthogHandlersRegistered: boolean | undefined;
};

function createPostHogClient(options: {
  flushAt: number;
  flushInterval: number;
  before_send?: BeforeSendFn;
}): PostHog | null {
  if (!POSTHOG_KEY) return null;

  return new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    ...options,
  });
}

/** Low-volume product events (e.g. `workspace_created`). Flushes immediately - safe delivery over batching. */
export const posthogServerClient: PostHog | null =
  globalForPostHog.posthogServerClient ?? createPostHogClient({ flushAt: 1, flushInterval: 0 });

/** High-volume AI/MCP tracing events. Batches to avoid one HTTP request per generation/tool call. */
export const posthogTracingClient: PostHog | null =
  globalForPostHog.posthogTracingClient ??
  createPostHogClient({
    flushAt: TRACING_FLUSH_AT,
    flushInterval: TRACING_FLUSH_INTERVAL_MS,
    before_send: stripAiError,
  });

if (!IS_PRODUCTION) {
  if (posthogServerClient) globalForPostHog.posthogServerClient = posthogServerClient;
  if (posthogTracingClient) globalForPostHog.posthogTracingClient = posthogTracingClient;
}

if (process.env.NEXT_RUNTIME === "nodejs" && !globalForPostHog.posthogHandlersRegistered) {
  const shutdownPostHog = () => {
    posthogServerClient?.shutdown().catch((err) => {
      logger.error(err, "Error shutting down PostHog server client");
    });
    posthogTracingClient?.shutdown().catch((err) => {
      logger.error(err, "Error shutting down PostHog tracing client");
    });
  };

  if (posthogServerClient || posthogTracingClient) {
    process.on("SIGTERM", shutdownPostHog);
    process.on("SIGINT", shutdownPostHog);
    globalForPostHog.posthogHandlersRegistered = true;
  }
}
