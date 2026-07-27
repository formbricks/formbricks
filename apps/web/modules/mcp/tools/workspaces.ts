import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listV3Workspaces } from "@/app/api/v3/workspaces/lib/operations";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { registerScopedTool } from "./guard-scopes";
import { type TMcpListWorkspacesInput, ZMcpListWorkspacesInput } from "./schemas";

export function registerWorkspaceTools(server: McpServer): void {
  // list_workspaces is the workspaceId-discovery prerequisite for BOTH the survey and workflow tools.
  // It gates on surveys:read because that is the mandatory MCP baseline read scope: auth.ts rejects any
  // token that lacks it, and every issued token carries it (API keys always include surveys:read +
  // workflows:read; DCR clients default to the full advertised set). So workflows:* is always granted
  // alongside surveys:read — a workflows-only token is intentionally unsupported (see the handbook).
  // Supporting one would require relaxing the auth.ts baseline to "any resource read scope" (follow-up).
  registerScopedTool(
    server,
    "list_workspaces",
    {
      title: "List workspaces",
      description:
        "List the Formbricks workspaces the authenticated user can access. Use this to discover the workspaceId required by the survey tools.",
      inputSchema: ZMcpListWorkspacesInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ["surveys:read"],
    async (_input: TMcpListWorkspacesInput, extra) => {
      const requestId = getMcpRequestId(extra.authInfo);
      const response = await listV3Workspaces({
        authentication: getMcpAuthentication(extra.authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );
}
