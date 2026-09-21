import type { McpServer } from "@modelcontextprotocol/server";
import { listV3Workspaces } from "@/app/api/v3/workspaces/lib/operations";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
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
        "List the Formbricks workspaces the authenticated user can access. Use this to discover the workspaceId required by the survey, workflow, feedback-record and response tools.",
      inputSchema: ZMcpListWorkspacesInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    // Every tool group needs a workspaceId first, so this has to admit any of them.
    //
    // `responses:read` is here for the end state, and is unreachable today: authentication requires at
    // least one scope from `MCP_RESOURCE_SCOPES`, which deliberately excludes `responses:*` while they
    // are grantable but unadvertised, so a responses-only token is refused with 403 before it reaches
    // any tool. It becomes live when the scopes are advertised (ENG-2852). Listed now rather than
    // later because the omission would then be a silent gap — this list is not what makes the entry
    // unreachable, so removing it would buy nothing and cost that.
    { anyOf: ["surveys:read", "workflows:read", "feedbackRecords:read", "responses:read"] },
    async (_input: TMcpListWorkspacesInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await listV3Workspaces({
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );
}
