import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { testWebhookDeliveryOperation } from "../lib/operations";
import { ZWebhookTestDeliveryBody, ZWebhookWorkspaceQuery } from "../schemas";

/**
 * `POST /api/internal/webhooks/test-deliveries?workspaceId=`: send a signed test payload to an endpoint,
 * through the same SSRF-guarded transport as real deliveries. Nothing is stored, so nothing is audited.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZWebhookWorkspaceQuery, body: ZWebhookTestDeliveryBody },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    testWebhookDeliveryOperation({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      body: parsedInput.body,
      requestId,
      instance,
    }),
});
