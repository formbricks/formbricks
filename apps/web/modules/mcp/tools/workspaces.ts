import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listV3Workspaces } from "@/app/api/v3/workspaces/lib/operations";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { registerScopedTool } from "./guard-scopes";
import { type TMcpListWorkspacesInput, ZMcpListWorkspacesInput } from "./schemas";

export function registerWorkspaceTools(server: McpServer): void {
  // list_workspaces is the workspaceId-discovery prerequisite for the survey, workflow AND
  // feedback-record tools, so it gates on ANY resource read scope rather than a single one. auth.ts's
  // baseline is now "at least one resource scope" (MCP_RESOURCE_SCOPES), so a workflows-only or
  // feedbackRecords-only token is a legitimate client and must still be able to discover its
  // workspaceId. The result is derived from the caller's own memberships/key grants, so admitting any
  // read scope exposes nothing extra.
  registerScopedTool(
    server,
    "list_workspaces",
    {
      title: "List workspaces",
      description:
        "List the Formbricks workspaces the authenticated user can access. Use this to discover the workspaceId required by the survey, workflow and feedback-record tools.",
      inputSchema: ZMcpListWorkspacesInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    { anyOf: ["surveys:read", "workflows:read", "feedbackRecords:read"] },
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
