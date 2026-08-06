import "server-only";
import { PostHogMCPAnalyticsProperty, instrument } from "@posthog/mcp";
import type { MCPAnalyticsOptions, McpAnalytics } from "@posthog/mcp";
import { logger } from "@formbricks/logger";
import { posthogTracingClient } from "./server";

const CONTENT_PROPERTIES: string[] = [
  PostHogMCPAnalyticsProperty.Parameters,
  PostHogMCPAnalyticsProperty.Response,
];

/**
 * Strips captured tool-call arguments/responses before they leave the process,
 * matching the privacy-mode default used for AI Observability (metadata only:
 * tool name, duration, errors, client info - never survey/feedback content).
 */
const beforeSend: NonNullable<MCPAnalyticsOptions["beforeSend"]> = (event) => {
  for (const property of CONTENT_PROPERTIES) {
    delete event.properties[property];
  }
  return event;
};

/**
 * Instruments an MCP server so PostHog auto-captures tool calls, tool listings,
 * and initialize requests. No-ops when PostHog isn't configured, or when
 * instrumentation itself fails for any reason - a broken/incompatible analytics
 * SDK must never take down the MCP server or any of its tools.
 *
 * Takes `identify` as a caller-supplied callback rather than importing MCP auth
 * helpers here: `lib/posthog` is a low-level, widely-imported barrel, and pulling
 * in `@/modules/mcp/auth` (which eagerly constructs an OAuth resource client at
 * module scope) previously created an import cycle back through
 * `lib/organization/service.ts` -> billing -> `lib/posthog`.
 */
export function instrumentMcpServerWithTracing(
  server: unknown,
  identify?: MCPAnalyticsOptions["identify"]
): McpAnalytics | undefined {
  if (!posthogTracingClient) return undefined;

  try {
    return instrument(server, posthogTracingClient, {
      identify,
      beforeSend,
      context: false,
      reportMissing: false,
    });
  } catch (error) {
    logger.warn({ error }, "Failed to instrument MCP server with PostHog tracing");
    return undefined;
  }
}
