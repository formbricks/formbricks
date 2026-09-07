import type {
  AuthInfo,
  CallToolResult,
  McpServer,
  StandardSchemaWithJSON,
  ToolAnnotations,
  ToolCallback,
} from "@modelcontextprotocol/server";
import {
  type TMcpToolContext,
  createMcpInsufficientScopeResponse,
  getMcpRequestId,
  getMcpToolAuthInfo,
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

type ScopedToolConfig<InputSchema extends StandardSchemaWithJSON> = {
  title?: string;
  description?: string;
  inputSchema?: InputSchema;
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
export function registerScopedTool<InputSchema extends StandardSchemaWithJSON>(
  server: McpServer,
  name: string,
  config: ScopedToolConfig<InputSchema>,
  // Non-empty tuple: a tool cannot be registered with `[]`, which would gate on nothing.
  requiredScopes: [string, ...string[]] | { anyOf: [string, ...string[]] },
  handler: ToolCallback<InputSchema>
): void {
  const guardedHandler = (async (input: unknown, ctx: TMcpToolContext) => {
    const authInfo = getMcpToolAuthInfo(ctx);
    const requestId = getMcpRequestId(authInfo);
    const scopeError =
      "anyOf" in requiredScopes
        ? await guardMcpAnyScope(authInfo, requiredScopes.anyOf, requestId)
        : await guardMcpScopes(authInfo, requiredScopes, requestId);
    if (scopeError) {
      return scopeError;
    }
    // Cast needed only because ToolCallback<InputSchema> is a conditional signature that TS can't call
    // with the erased `unknown` params here. It's safe: the SDK validates `input` against this tool's
    // inputSchema BEFORE invoking guardedHandler, and we forward the exact same `input`/`ctx` through
    // unchanged — so the runtime value already conforms to the handler's declared type; nothing is
    // reshaped.
    return (handler as (input: unknown, ctx: unknown) => Promise<CallToolResult>)(input, ctx);
  }) as ToolCallback<InputSchema>;

  server.registerTool(name, config, guardedHandler);
}
