import "server-only";
import { PostHogMCPAnalyticsProperty, instrument } from "@posthog/mcp";
import type { MCPAnalyticsOptions, McpAnalytics } from "@posthog/mcp";
import { logger } from "@formbricks/logger";
import { posthogTracingClient } from "./server";

// Raw PostHog properties @posthog/mcp writes that aren't part of its own
// PostHogMCPAnalyticsProperty enum, but are structural rather than tool-call
// content and must survive `beforeSend`. In particular `$groups` is read by
// the SDK's sink straight off `event.properties.$groups` *after* beforeSend
// runs (see @posthog/mcp's sink.js) - stripping it would silently break
// organization/workspace grouping without ever throwing.
const STRUCTURAL_PROPERTIES: string[] = ["$groups", "$process_person_profile", "$set"];

// Allowlist, not a denylist: only these survive; anything else - a property
// we haven't audited, or one a future SDK version adds - is dropped by
// default instead of potentially leaking. This matters more here than for a
// typical analytics nicety: the feedback-record MCP tools carry end-user
// content (`value_text`, a respondent's open-text answer), not just survey
// config, so "unknown defaults to stripped" is the safe failure mode.
// Deliberately excluded: Parameters/Response (tool call I/O), ErrorMessage
// (raw exception text - can echo back invalid input), Intent/IntentSource/
// ConversationId (unused - context injection is off, see identifyMcpUser).
const ALLOWED_PROPERTIES = new Set<string>([
  ...STRUCTURAL_PROPERTIES,
  PostHogMCPAnalyticsProperty.Source,
  PostHogMCPAnalyticsProperty.SessionId,
  PostHogMCPAnalyticsProperty.ResourceName,
  PostHogMCPAnalyticsProperty.ToolName,
  PostHogMCPAnalyticsProperty.ToolDescription,
  PostHogMCPAnalyticsProperty.ToolCategory,
  PostHogMCPAnalyticsProperty.ListedToolNames,
  PostHogMCPAnalyticsProperty.DurationMs,
  PostHogMCPAnalyticsProperty.ServerName,
  PostHogMCPAnalyticsProperty.ServerVersion,
  PostHogMCPAnalyticsProperty.ClientName,
  PostHogMCPAnalyticsProperty.ClientVersion,
  PostHogMCPAnalyticsProperty.ProtocolVersion,
  PostHogMCPAnalyticsProperty.IsError,
  PostHogMCPAnalyticsProperty.ErrorType,
]);

/**
 * Strips every captured property except the allowlisted metadata above,
 * matching the privacy-mode default used for AI Observability (metadata
 * only - never survey/feedback content).
 */
const beforeSend: NonNullable<MCPAnalyticsOptions["beforeSend"]> = (event) => {
  if (event.properties) {
    for (const key of Object.keys(event.properties)) {
      if (!ALLOWED_PROPERTIES.has(key)) {
        delete event.properties[key];
      }
    }
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
      // Defaults to true. The sibling `$exception` event it emits on every
      // failed tool call carries its payload via `event.error` properties
      // ($exception_list, etc.) that live outside our allowlist entirely -
      // not stripped by beforeSend, just not covered by it. MCP errors
      // already go to Sentry; $mcp_is_error/$mcp_error_type (allowlisted)
      // keep the failure-rate/reason breakdown on the PostHog side.
      enableExceptionAutocapture: false,
    });
  } catch (error) {
    logger.warn({ error }, "Failed to instrument MCP server with PostHog tracing");
    return undefined;
  }
}
