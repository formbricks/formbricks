import "server-only";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
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
// `identify` is a union of callback | static identity | null — pick the callback member so
// callers (and tests) can invoke this directly.
type TMcpIdentifyFn = Extract<NonNullable<MCPAnalyticsOptions["identify"]>, CallableFunction>;

export const identifyMcpUser: TMcpIdentifyFn = async (_request, extra) => {
  try {
    const authInfo = (extra as { authInfo?: AuthInfo } | undefined)?.authInfo;
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
  {
    serverInfo: {
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    },
  },
  {
    basePath: "/api",
    disableSse: true,
    maxDuration: 60,
    sessionIdGenerator: undefined,
    verboseLogs: false,
  }
);
