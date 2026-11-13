import type {
  TWebhookCreateBody,
  TWebhookTestDeliveryBody,
  TWebhookUpdateBody,
} from "@/app/api/internal/webhooks/schemas";
import type {
  TCreatedWebhookResource,
  TWebhookTestDeliveryResource,
} from "@/app/api/internal/webhooks/serializers";
import { buildApiUrl, sendApiRequest } from "@/modules/api/lib/internal-api-client";

/**
 * The Webhooks page's writes to `/api/internal/webhooks`. Each throws a `V3ApiError` on a refusal, with the
 * server's reason (an SSRF-rejected URL, an endpoint error, a restricted survey) as its message.
 */

const BASE_PATH = "/api/internal/webhooks";
const webhookPath = (webhookId: string) => `${BASE_PATH}/${encodeURIComponent(webhookId)}`;

/** Create a webhook; the response carries its signing secret, shown once. */
export const createWebhook = ({ workspaceId, body }: { workspaceId: string; body: TWebhookCreateBody }) =>
  sendApiRequest<TCreatedWebhookResource>(buildApiUrl(BASE_PATH, { workspaceId }), { method: "POST", body });

/** Replace a webhook's name, URL, triggers and surveys. */
export const updateWebhook = ({ webhookId, body }: { webhookId: string; body: TWebhookUpdateBody }) =>
  sendApiRequest<void>(webhookPath(webhookId), { method: "PUT", body });

export const deleteWebhook = (webhookId: string) =>
  sendApiRequest<void>(webhookPath(webhookId), { method: "DELETE" });

/**
 * Send a signed test payload to an endpoint. No client timeout: the server gives the endpoint the delivery
 * timeout, and a shorter one here would report a failure the endpoint never gave.
 */
export const testWebhookEndpoint = ({
  workspaceId,
  body,
}: {
  workspaceId: string;
  body: TWebhookTestDeliveryBody;
}) =>
  sendApiRequest<TWebhookTestDeliveryResource>(buildApiUrl(`${BASE_PATH}/test-deliveries`, { workspaceId }), {
    method: "POST",
    body,
    timeoutMs: null,
  });
