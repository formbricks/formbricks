import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { ZodRawShape } from "zod";
import { createMcpInsufficientScopeResponse, getMcpRequestId, hasMcpScopes } from "../auth";
import { responseToMcpToolResult } from "../errors";

/**
 * Shared MCP scope gate: returns `null` when the caller holds all `requiredScopes`, otherwise an
 * insufficient-scope tool result. Used by every tool before it touches a v3 operation.
 */
async function guardMcpScopes(
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
 */
export function registerScopedTool<InputArgs extends ZodRawShape>(
  server: McpServer,
  name: string,
  config: ScopedToolConfig<InputArgs>,
  requiredScopes: string[],
  handler: ToolCallback<InputArgs>
): void {
  const guardedHandler = (async (input: unknown, extra: { authInfo?: AuthInfo }) => {
    const requestId = getMcpRequestId(extra.authInfo);
    const scopeError = await guardMcpScopes(extra.authInfo, requiredScopes, requestId);
    if (scopeError) {
      return scopeError;
    }
    return (handler as (input: unknown, extra: unknown) => Promise<CallToolResult>)(input, extra);
  }) as ToolCallback<InputArgs>;

  server.registerTool(name, config, guardedHandler);
}
