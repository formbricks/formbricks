import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createMcpInsufficientScopeResponse, hasMcpScopes } from "../auth";
import { responseToMcpToolResult } from "../errors";

/**
 * Shared MCP scope gate: returns `null` when the caller holds all `requiredScopes`, otherwise an
 * insufficient-scope tool result. Used by every tool before it touches a v3 operation.
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
