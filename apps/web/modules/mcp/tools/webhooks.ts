import type { McpServer } from "@modelcontextprotocol/server";
import {
  createV3Webhook,
  deleteV3Webhook,
  getV3Webhook,
  listV3Webhooks,
  testV3Webhook,
  updateV3Webhook,
} from "@/app/api/v3/webhooks/lib/operations";
import {
  ZV3WebhookCreatedResource,
  ZV3WebhookIdResource,
  ZV3WebhookResource,
  ZV3WebhookTestResult,
} from "@/app/api/v3/webhooks/lib/schemas";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import { getMcpAuthentication, getMcpRequestId, getMcpToolAuthInfo } from "../auth";
import { responseToMcpToolResult } from "../errors";
import { registerScopedTool } from "./guard-scopes";
import { mcpToolOutput } from "./output-schemas";
import { runMcpMutation } from "./run-mcp-mutation";
import {
  type TMcpCreateWebhookInput,
  type TMcpDeleteWebhookInput,
  type TMcpGetWebhookInput,
  type TMcpListWebhooksInput,
  type TMcpTestWebhookInput,
  type TMcpUpdateWebhookInput,
  ZMcpCreateWebhookInput,
  ZMcpDeleteWebhookInput,
  ZMcpGetWebhookInput,
  ZMcpListWebhooksInput,
  ZMcpTestWebhookInput,
  ZMcpUpdateWebhookInput,
} from "./webhook-schemas";

const ZMcpWebhookListOutput = mcpToolOutput(ZV3WebhookResource.array());
const ZMcpWebhookOutput = mcpToolOutput(ZV3WebhookResource);
const ZMcpWebhookCreatedOutput = mcpToolOutput(ZV3WebhookCreatedResource);
const ZMcpWebhookIdOutput = mcpToolOutput(ZV3WebhookIdResource);
const ZMcpWebhookTestOutput = mcpToolOutput(ZV3WebhookTestResult);

/**
 * Webhooks: workspace endpoints Formbricks POSTs response events to. Their own scope family
 * (`webhooks:read` / `webhooks:write`), because a webhook sends responses outside the product. The scope is
 * the first gate; each operation still resolves the workspace from the webhook and requires access to it.
 */
export function registerWebhookTools(server: McpServer): void {
  registerScopedTool(
    server,
    "list_webhooks",
    {
      title: "List webhooks",
      description:
        "List a workspace's webhooks: URL, triggers and the surveys each covers. Secrets are never returned.",
      inputSchema: ZMcpListWebhooksInput,
      outputSchema: ZMcpWebhookListOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    ["webhooks:read"],
    async (input: TMcpListWebhooksInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await listV3Webhooks({
        workspaceId: input.workspaceId,
        limit: input.limit,
        cursor: input.cursor,
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );

  registerScopedTool(
    server,
    "get_webhook",
    {
      title: "Get webhook",
      description: "Read one webhook. The signing secret is never returned.",
      inputSchema: ZMcpGetWebhookInput,
      outputSchema: ZMcpWebhookOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    ["webhooks:read"],
    async (input: TMcpGetWebhookInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await getV3Webhook({
        webhookId: input.webhookId,
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );

  registerScopedTool(
    server,
    "create_webhook",
    {
      title: "Create webhook",
      description:
        "Create a webhook that receives response events. Returns the signing secret ONCE, in this result only; store it now, it cannot be read again. An empty surveyIds sends every survey in the workspace.",
      inputSchema: ZMcpCreateWebhookInput,
      outputSchema: ZMcpWebhookCreatedOutput,
      audit: { action: "created", targetType: "webhook" },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    ["webhooks:write"],
    async (input: TMcpCreateWebhookInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "created", resource: "webhook", logContext: { workspaceId: input.workspaceId } },
        ({ authentication, requestId, auditLog }) =>
          createV3Webhook({
            body: input,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );

  registerScopedTool(
    server,
    "update_webhook",
    {
      title: "Update webhook",
      description:
        "Change a webhook's name, URL, triggers or surveys. Only the fields you send change; triggers and surveyIds replace the whole list. The secret is unchanged.",
      inputSchema: ZMcpUpdateWebhookInput,
      outputSchema: ZMcpWebhookOutput,
      audit: { action: "updated", targetType: "webhook", targetIdArg: "webhookId" },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    ["webhooks:write"],
    async ({ webhookId, ...body }: TMcpUpdateWebhookInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "updated", resource: "webhook", logContext: { webhookId } },
        ({ authentication, requestId, auditLog }) =>
          updateV3Webhook({
            webhookId,
            body,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );

  registerScopedTool(
    server,
    "delete_webhook",
    {
      title: "Delete webhook",
      description: "Delete a webhook. Events stop being sent to its URL; this cannot be undone.",
      inputSchema: ZMcpDeleteWebhookInput,
      outputSchema: ZMcpWebhookIdOutput,
      audit: { action: "deleted", targetType: "webhook", targetIdArg: "webhookId" },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    ["webhooks:write"],
    async (input: TMcpDeleteWebhookInput, ctx) =>
      runMcpMutation(
        ctx,
        { action: "deleted", resource: "webhook", logContext: { webhookId: input.webhookId } },
        ({ authentication, requestId, auditLog }) =>
          deleteV3Webhook({
            webhookId: input.webhookId,
            authentication,
            requestId,
            instance: MCP_API_ROUTE,
            auditLog,
          })
      )
  );

  registerScopedTool(
    server,
    "test_webhook",
    {
      title: "Test webhook",
      description:
        "Send one signed test event to the webhook's stored URL and report the outcome. A failed delivery is returned as delivered: false with the reason, not as an error.",
      inputSchema: ZMcpTestWebhookInput,
      outputSchema: ZMcpWebhookTestOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    ["webhooks:write"],
    async (input: TMcpTestWebhookInput, ctx) => {
      const authInfo = getMcpToolAuthInfo(ctx);
      const requestId = getMcpRequestId(authInfo);
      const response = await testV3Webhook({
        webhookId: input.webhookId,
        authentication: getMcpAuthentication(authInfo),
        requestId,
        instance: MCP_API_ROUTE,
      });

      return await responseToMcpToolResult(response, requestId);
    }
  );
}
