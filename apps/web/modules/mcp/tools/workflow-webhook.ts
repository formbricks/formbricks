import type { McpServer } from "@modelcontextprotocol/server";
import { buildWorkflowApiContext, workflowsHandlers } from "@/app/api/v3/workflows/lib/context";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { registerScopedTool } from "./guard-scopes";
import { runMcpMutation } from "./run-mcp-mutation";
import { type TMcpWorkflowIdInput, ZMcpWorkflowIdInput } from "./workflow-schemas";
import { type TMcpSetSamplePayloadInput, ZMcpSetSamplePayloadInput } from "./workflow-webhook-schemas";

/**
 * Webhook trigger tools (ENG-7177), thin adapters over the v3 webhook operations. The Webhook Secret URL
 * is a credential (ADR 0041), so even reading it needs `workflows:write`, and the descriptions say so.
 */
export function registerWorkflowWebhookTools(server: McpServer): void {
  registerScopedTool(
    server,
    "get_webhook_url",
    {
      title: "Get Webhook Secret URL",
      description: [
        "Get a Webhook workflow's Secret URL, its last call and its Sample payload with the Variables it offers.",
        "The URL is a credential: anyone holding it can start runs. Do not repeat, log or share it unless the user asks;",
        "use regenerate_webhook_url if it leaked.",
      ].join(" "),
      inputSchema: ZMcpWorkflowIdInput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    ["workflows:write"],
    async (input: TMcpWorkflowIdInput, mcpCtx) => {
      const authInfo = getMcpToolAuthInfo(mcpCtx);
      const requestId = getMcpRequestId(authInfo);
      const ctx = buildWorkflowApiContext(getMcpAuthentication(authInfo), requestId, MCP_API_ROUTE);
      const response = await workflowsHandlers.getWebhook({ ctx, params: { workflowId: input.workflowId } });
      return await responseToMcpToolResult(response, requestId);
    }
  );

  registerScopedTool(
    server,
    "regenerate_webhook_url",
    {
      title: "Regenerate Webhook Secret URL",
      description:
        "Replace a Webhook workflow's Secret URL. The old URL stops working at once, so every caller must be given the new one. Returns the new URL, a credential.",
      inputSchema: ZMcpWorkflowIdInput,
      audit: { action: "webhookUrlRegenerated", targetType: "workflow", targetIdArg: "workflowId" },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    ["workflows:write"],
    async (input: TMcpWorkflowIdInput, mcpCtx) =>
      runMcpMutation(
        mcpCtx,
        { action: "webhookUrlRegenerated", resource: "workflow" },
        ({ authentication, requestId, auditLog }) =>
          workflowsHandlers.regenerateWebhook({
            ctx: buildWorkflowApiContext(authentication, requestId, MCP_API_ROUTE, auditLog ?? undefined),
            params: { workflowId: input.workflowId },
          })
      )
  );

  registerScopedTool(
    server,
    "set_sample_payload",
    {
      title: "Set Sample payload",
      description:
        "Replace a Webhook workflow's Sample payload (a JSON object up to 100 KB, 10 levels deep) and get back the Variables it offers. Replaces the previous sample.",
      inputSchema: ZMcpSetSamplePayloadInput,
      audit: { action: "updated", targetType: "workflow", targetIdArg: "workflowId" },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    ["workflows:write"],
    async (input: TMcpSetSamplePayloadInput, mcpCtx) =>
      runMcpMutation(
        mcpCtx,
        { action: "updated", resource: "workflow" },
        ({ authentication, requestId, auditLog }) =>
          workflowsHandlers.setSample({
            // The operation reads its body off a request; this one is never dispatched.
            req: new Request(new URL(MCP_API_ROUTE, "https://mcp.internal"), {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ payload: input.payload }),
            }),
            ctx: buildWorkflowApiContext(authentication, requestId, MCP_API_ROUTE, auditLog ?? undefined),
            params: { workflowId: input.workflowId },
          })
      )
  );
}
