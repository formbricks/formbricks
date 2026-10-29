import type { McpServer } from "@modelcontextprotocol/server";
import type { z } from "zod";
import { getV3AccountContext } from "@/app/api/v3/account/lib/context";
import { ZV3AccountContext } from "@/app/api/v3/account/lib/schemas";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { type TMcpGetAccountContextInput, ZMcpGetAccountContextInput } from "./account-schemas";
import { registerScopedTool } from "./guard-scopes";
import { plural, withIdSummary } from "./id-summary";
import { mcpToolOutput } from "./output-schemas";
import { ACCOUNT_READ_SCOPES } from "./setup-scopes";

const ZMcpAccountContextOutput = mcpToolOutput(ZV3AccountContext);

/**
 * What the model reads after `get_account_context`: ids, roles and counts, never a name. The names,
 * emails and per-workspace branding are in `structuredContent`.
 */
export function summarizeAccountContext(context: z.infer<typeof ZV3AccountContext>): string {
  const subject =
    context.principal === "user" && context.user ? `user ${context.user.id}` : "an API key principal";
  const organizations = context.organizations.map((organization) => {
    const listed = organization.workspaces.map((workspace) => workspace.id).join(", ");
    const workspaces = `${plural(organization.workspaceCount, "workspace")}${
      organization.workspacesTruncated ? ` (list cut at ${organization.workspaces.length})` : ""
    }${listed ? `: ${listed}` : ""}`;
    return `organization ${organization.id} (role ${organization.role ?? "none"}, ${workspaces})`;
  });

  return [
    `Account context for ${subject}: ${plural(context.setup.organizationCount, "organization")}, ${plural(context.setup.workspaceCount, "workspace")}, ${plural(context.setup.surveyCount, "survey")}.`,
    organizations.length > 0 ? `${organizations.join("; ")}.` : "",
    "Names, roles and per-workspace setup facts (survey counts, branding) are in structuredContent.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function registerAccountTools(server: McpServer): void {
  registerScopedTool(
    server,
    "get_account_context",
    {
      title: "Get account context",
      description:
        "Read what is known about the person you work for: who they are, their role in each organization, the organizations and workspaces they can reach, and derived setup facts (workspace and survey counts, whether each workspace has branding, whether they may create a workspace or another organization). Call it first when setting up an account. Nothing is stored: it is safe to call again at any time.",
      inputSchema: ZMcpGetAccountContextInput,
      outputSchema: ZMcpAccountContextOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ACCOUNT_READ_SCOPES,
    async (_input: TMcpGetAccountContextInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await getV3AccountContext({
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return withIdSummary(
        await responseToMcpToolResult(response, requestId),
        ZV3AccountContext,
        summarizeAccountContext
      );
    }
  );
}
