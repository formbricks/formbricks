import { z } from "zod";
import {
  V3_WEBHOOK_MAX_SURVEYS,
  ZV3CreateWebhookBody,
  ZV3UpdateWebhookBody,
  ZV3WebhookIdParams,
} from "@/app/api/v3/webhooks/lib/schemas";

const MCP_WEBHOOK_LIST_DEFAULT_LIMIT = 20;
const MCP_WEBHOOK_LIST_MAX_LIMIT = 100;

const webhookIdField = z.cuid2().describe("Webhook ID. Use list_webhooks to discover ids.");

const surveyIdsDescription = `IDs of the surveys whose responses are sent, at most ${V3_WEBHOOK_MAX_SURVEYS}. Each must be a survey of this webhook's workspace that is visible to the whole workspace. An EMPTY list means EVERY survey in the workspace, including surveys created later.`;

const triggersDescription =
  "Events that fire the webhook, at least one: responseCreated, responseUpdated, responseFinished.";

const urlDescription =
  "Endpoint Formbricks POSTs events to. http or https only; private, loopback, link-local and cloud-metadata addresses are refused.";

export const ZMcpListWebhooksInput = z
  .object({
    workspaceId: z.cuid2().describe("Workspace ID whose webhooks should be listed."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MCP_WEBHOOK_LIST_MAX_LIMIT)
      .default(MCP_WEBHOOK_LIST_DEFAULT_LIMIT)
      .describe(`Page size (default ${MCP_WEBHOOK_LIST_DEFAULT_LIMIT}, max ${MCP_WEBHOOK_LIST_MAX_LIMIT}).`),
    cursor: z.string().min(1).optional().describe("Opaque cursor from the previous page's meta.nextCursor."),
  })
  .strict();

export const ZMcpGetWebhookInput = ZV3WebhookIdParams.extend({ webhookId: webhookIdField }).strict();

export const ZMcpCreateWebhookInput = ZV3CreateWebhookBody.extend({
  workspaceId: z.cuid2().describe("Workspace the webhook is created in."),
  name: ZV3CreateWebhookBody.shape.name.describe("Optional label shown to people managing the workspace."),
  url: ZV3CreateWebhookBody.shape.url.describe(urlDescription),
  source: ZV3CreateWebhookBody.shape.source.describe(
    "Who set the webhook up, for display only: user (default), zapier, make, n8n or activepieces."
  ),
  triggers: ZV3CreateWebhookBody.shape.triggers.describe(triggersDescription),
  surveyIds: ZV3CreateWebhookBody.shape.surveyIds.describe(surveyIdsDescription),
}).strict();

export const ZMcpUpdateWebhookInput = ZV3WebhookIdParams.extend({
  ...ZV3UpdateWebhookBody.shape,
  webhookId: webhookIdField,
  name: ZV3UpdateWebhookBody.shape.name.describe("New label, or null to clear it."),
  url: ZV3UpdateWebhookBody.shape.url.describe(urlDescription),
  triggers: ZV3UpdateWebhookBody.shape.triggers.describe(
    `Replaces the whole trigger list. ${triggersDescription}`
  ),
  surveyIds: ZV3UpdateWebhookBody.shape.surveyIds.describe(
    `Replaces the whole survey list. ${surveyIdsDescription}`
  ),
}).strict();

export const ZMcpDeleteWebhookInput = ZV3WebhookIdParams.extend({ webhookId: webhookIdField }).strict();

export const ZMcpTestWebhookInput = ZV3WebhookIdParams.extend({ webhookId: webhookIdField }).strict();

export type TMcpListWebhooksInput = z.infer<typeof ZMcpListWebhooksInput>;
export type TMcpGetWebhookInput = z.infer<typeof ZMcpGetWebhookInput>;
export type TMcpCreateWebhookInput = z.infer<typeof ZMcpCreateWebhookInput>;
export type TMcpUpdateWebhookInput = z.infer<typeof ZMcpUpdateWebhookInput>;
export type TMcpDeleteWebhookInput = z.infer<typeof ZMcpDeleteWebhookInput>;
export type TMcpTestWebhookInput = z.infer<typeof ZMcpTestWebhookInput>;
