/**
 * POST /api/v3/webhooks/{webhookId}/test — send one signed test event to the webhook's stored URL.
 *
 * Only the stored URL, never one in the request: the server will not call an address that was not accepted
 * as a webhook target. A failed delivery answers 200 with `delivered: false`.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { testV3Webhook } from "../../lib/operations";
import { ZV3WebhookIdParams } from "../../lib/schemas";

export const POST = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZV3WebhookIdParams },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    testV3Webhook({ authentication, webhookId: parsedInput.params.webhookId, requestId, instance }),
});
