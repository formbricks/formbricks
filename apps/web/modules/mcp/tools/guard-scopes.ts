import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { ZodRawShape } from "zod";
import {
  createMcpInsufficientScopeResponse,
  getMcpRequestId,
  hasAnyMcpScope,
  hasMcpScopes,
} from "../auth";
import { responseToMcpToolResult } from "../errors";

/**
 * Shared MCP scope gate: returns `null` when the caller holds all `requiredScopes`, otherwise an
 * insufficient-scope tool result. Used by every tool before it touches a v3 operation.
 *
 * Exported for the feedback-record tools, which centralise the gate in their own shared read/write
 * handler factories rather than at registration. Prefer `registerScopedTool` for new tools: it makes
 * the gate structural (see ENG-1967) instead of something a hand-written handler can omit.
 */
export async function guardMcpScopes(
  authInfo: AuthInfo | undefined,
  requiredScopes: string[],
  requestId: string
): Promise<CallToolResult | null> {
  if (hasMcpScopes(authInfo, requiredScopes)) {
    return null;
  }

  return await responseToMcpToolResult(
    createMcpInsufficientScopeResponse(requestId, requiredScopes),
    requestId
  );
}

/**
 * Any-of variant for tools that more than one scope group legitimately depends on — currently the
 * workspace discovery tool, which the survey, workflow and feedback-record tools all need to resolve a
 * `workspaceId`. Returns `null` when the caller holds at least one of `allowedScopes`. The challenge
 * still advertises the full list, since RFC 6750 has no way to express "any one of these".
 */
export async function guardMcpAnyScope(
  authInfo: AuthInfo | undefined,
  allowedScopes: string[],
  requestId: string
): Promise<CallToolResult | null> {
  if (hasAnyMcpScope(authInfo, allowedScopes)) {
    return null;
  }

  return await responseToMcpToolResult(
    createMcpInsufficientScopeResponse(requestId, allowedScopes),
    requestId
  );
}

type ScopedToolConfig<InputArgs extends ZodRawShape> = {
  title?: string;
  description?: string;
  inputSchema?: InputArgs;
  annotations?: ToolAnnotations;
};

/**
 * Register an MCP tool with a MANDATORY OAuth scope gate. `requiredScopes` is a required argument, so a
 * tool cannot be registered without declaring the scope it needs — the gate always runs (returning a
 * 403 insufficient-scope result) BEFORE the handler, so no tool can reach a v3 operation unguarded.
 *
 * This is the single registration path for every MCP tool: read tools pass `["<resource>:read"]`,
 * mutating tools pass `["<resource>:write"]`. Enforcing scope structurally (vs. a per-tool
 * `guardMcpScopes` call that's easy to forget) is what prevents the ENG-1967 class of gap from
 * recurring as new tools are added.
 *
 * Pass `{ anyOf: [...] }` instead of a plain tuple for the rare tool that more than one scope group
 * legitimately reaches (workspace discovery). That keeps such tools on this registration path rather
 * than dropping them to a raw `server.registerTool` with a hand-rolled gate.
 */
export function registerScopedTool<InputArgs extends ZodRawShape>(
  server: McpServer,
  name: string,
  config: ScopedToolConfig<InputArgs>,
  // Non-empty tuple: a tool cannot be registered with `[]`, which would gate on nothing.
  requiredScopes: [string, ...string[]] | { anyOf: [string, ...string[]] },
  handler: ToolCallback<InputArgs>
): void {
  const guardedHandler = (async (input: unknown, extra: { authInfo?: AuthInfo }) => {
    const requestId = getMcpRequestId(extra.authInfo);
    const scopeError =
      "anyOf" in requiredScopes
        ? await guardMcpAnyScope(extra.authInfo, requiredScopes.anyOf, requestId)
        : await guardMcpScopes(extra.authInfo, requiredScopes, requestId);
    if (scopeError) {
      return scopeError;
    }
    // Cast needed only because ToolCallback<InputArgs> is an overloaded/conditional signature that
    // TS can't call with the erased `unknown` params here. It's safe: the SDK validates `input`
    // against this tool's inputSchema (InputArgs) BEFORE invoking guardedHandler, and we forward the
    // exact same `input`/`extra` through unchanged — so the runtime value already conforms to the
    // handler's declared type; nothing is reshaped.
    return (handler as (input: unknown, extra: unknown) => Promise<CallToolResult>)(input, extra);
  }) as ToolCallback<InputArgs>;

  server.registerTool(name, config, guardedHandler);
}
