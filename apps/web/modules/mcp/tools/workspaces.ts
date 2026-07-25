import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listV3Workspaces } from "@/app/api/v3/workspaces/lib/operations";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { guardMcpAnyScope } from "./guard-scopes";
import { type TMcpListWorkspacesInput, ZMcpListWorkspacesInput } from "./schemas";

export function registerWorkspaceTools(server: McpServer): void {
  server.registerTool(
    "list_workspaces",
    {
      title: "List workspaces",
      description:
        "List the Formbricks workspaces the authenticated user can access. Use this to discover the workspaceId required by the survey and feedback-record tools.",
      inputSchema: ZMcpListWorkspacesInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (_input: TMcpListWorkspacesInput, extra) => {
      const requestId = getMcpRequestId(extra.authInfo);
      // Workspace discovery is the read-prerequisite for every other tool group, so any read scope is
      // enough — a feedbackRecords-only token still needs a workspaceId. The result is derived from the
      // caller's own memberships/key grants, so it exposes nothing extra either way.
      const scopeError = await guardMcpAnyScope(
        extra.authInfo,
        ["surveys:read", "feedbackRecords:read"],
        requestId
      );
      if (scopeError) {
        return scopeError;
      }

      const response = await listV3Workspaces({
        authentication: getMcpAuthentication(extra.authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );
}
