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
// `identify` is a union of callback | static identity | null — pick the callback member so
// callers (and tests) can invoke this directly.
type TMcpIdentifyFn = Extract<NonNullable<MCPAnalyticsOptions["identify"]>, CallableFunction>;

export const identifyMcpUser: TMcpIdentifyFn = async (_request, extra) => {
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

/**
 * One options object in v2 (it was three arguments in v1). The v1 handler options are gone rather than
 * moved: `sessionIdGenerator` and `disableSse` because protocol 2026-07-28 removed sessions and the SSE
 * transport outright, and `basePath`/`maxDuration` because the handler now serves whatever route the
 * framework mounts it on - `app/api/mcp/route.ts` is that mount point.
 *
 * Exported so the choices below can be asserted directly. The alternative - reading
 * `createMcpHandler.mock.calls` - cannot work in this repo: `vitestSetup.ts` runs `vi.resetAllMocks()`
 * in a global `beforeEach`, which wipes the import-time call before any test body runs.
 */
export const MCP_HANDLER_OPTIONS = {
  serverInfo: {
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
  },
  verboseLogs: false,
  // Refuse `subscriptions/listen` outright. Protocol 2026-07-28 replaced the GET SSE endpoint and
  // `resources/subscribe` with a long-lived POST-response stream, which this POST route now serves -
  // under the v1 `disableSse: true` there was no long-lived path at all, so the migration would
  // otherwise open one. We register no resources and emit no list-changed notifications, so such a
  // stream can never deliver anything: a 2026-era client opens one on connect and then holds a
  // connection plus a keepalive timer for nothing. The SDK's default cap is 1024 *per process*, and
  // this handler is a module singleton, so any authenticated caller could hold that many.
  //
  // 0 disables rather than meaning "unlimited": the router gates on `open.size >= maxSubscriptions`
  // and the option is read with `??`, so 0 survives instead of falling back to the default. Verified
  // against the SDK - a listen request comes back `-32603 Subscription limit reached` on plain JSON
  // with the connection closed, instead of a held-open `text/event-stream`.
  //
  // Refusing it is safe for a real 2026-era client, which was the open question: Claude Code takes the
  // refusal, goes straight on to `tools/list`, retries the stream three times with exponential backoff
  // (1s/2s/4s), gives up, and calls tools normally. Not fatal, and not a hot loop. If a future client
  // does treat it as fatal, prefer `maxSubscriptions: 1` (accepted but capped) over reverting to the
  // default.
  //
  // Revisit when we actually have something to notify about (resources, or tools that change at
  // runtime); `mcp-handler` 2.1.1 is the version that forwards this option.
  maxSubscriptions: 0,
} as const;

export const mcpHandler = createMcpHandler((server) => {
  registerSurveyTools(server);
  registerWorkflowTools(server);
  registerWorkspaceTools(server);
  registerFeedbackRecordTools(server);
  instrumentMcpServerWithTracing(server, identifyMcpUser);
}, MCP_HANDLER_OPTIONS);
