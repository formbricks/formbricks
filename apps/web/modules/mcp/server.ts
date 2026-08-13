import "server-only";
import type { AuthInfo } from "@modelcontextprotocol/server";
import type { MCPAnalyticsOptions } from "@posthog/mcp";
import { createMcpHandler } from "mcp-handler";
import { logger } from "@formbricks/logger";
import { instrumentMcpServerWithTracing } from "@/lib/posthog/mcp-tracing";
import { getMcpAuthentication } from "./auth";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "./constants";
import { registerFeedbackRecordTools } from "./tools/feedback-records";
import { registerSurveyTools } from "./tools/surveys";
import { registerWorkflowTools } from "./tools/workflows";
import { registerWorkspaceTools } from "./tools/workspaces";

/**
 * PostHog's MCP SDK awaits `identify()` before the real tool handler runs (it
 * resolves identity/metadata as part of building the analytics event, ahead of
 * `execute()` - see @posthog/mcp's `prepareToolCallEvent`). That puts this
 * function on the critical path of every single tool call, so it must stay
 * synchronous-cheap: no DB/network calls here, ever. This is also why OAuth
 * sessions get no organization group - OAuth tokens are user-scoped (a user can
 * belong to several organizations), so resolving one correctly would require a
 * lookup, which this path can't afford. API keys already carry organizationId
 * with no extra work, so they get grouped; OAuth calls don't.
 *
 * Never let identity resolution break a real tool call - analytics identity is
 * best-effort. Any failure here falls back to an anonymous event, not a thrown
 * error into the MCP request path.
 */
export const identifyMcpUser: NonNullable<MCPAnalyticsOptions["identify"]> = async (_request, extra) => {
  try {
    // Read BOTH locations, deliberately. @posthog/mcp hands us its own compat context, where SDK v2's
    // auth sits at `http.authInfo` while v1's sat flat on `extra.authInfo`. Reading only the flat one
    // (as this did before the v2 migration) yields undefined and degrades every MCP event to an
    // anonymous distinctId - and because identity here is best-effort by design, that failure is
    // completely silent. Keeping the v1 fallback costs nothing and covers a compat context built by an
    // older analytics SDK.
    const context = extra as { authInfo?: AuthInfo; http?: { authInfo?: AuthInfo } } | undefined;
    const authInfo = context?.http?.authInfo ?? context?.authInfo;
    const authentication = getMcpAuthentication(authInfo);

    if (!authentication) return null;

    if ("apiKeyId" in authentication) {
      return {
        distinctId: `apiKey:${authentication.apiKeyId}`,
        groups: { organization: authentication.organizationId },
      };
    }

    return { distinctId: authentication.user.id };
  } catch (error) {
    logger.warn({ error }, "Failed to identify MCP user for PostHog tracing");
    return null;
  }
};

export const mcpHandler = createMcpHandler(
  (server) => {
    registerSurveyTools(server);
    registerWorkflowTools(server);
    registerWorkspaceTools(server);
    registerFeedbackRecordTools(server);
    instrumentMcpServerWithTracing(server, identifyMcpUser);
  },
  // One options object in v2 (it was three arguments in v1). The v1 handler options are gone rather
  // than moved: `sessionIdGenerator` and `disableSse` because protocol 2026-07-28 removed sessions and
  // the SSE transport outright, and `basePath`/`maxDuration` because the handler now serves whatever
  // route the framework mounts it on - `app/api/mcp/route.ts` is that mount point.
  {
    serverInfo: {
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    },
    verboseLogs: false,
  }
);
