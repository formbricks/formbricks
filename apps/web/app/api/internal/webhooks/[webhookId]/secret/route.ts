import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getWebhookSecretOperation } from "../../lib/operations";
import { ZWebhookIdParams } from "../../schemas";

/**
 * `GET /api/internal/webhooks/{webhookId}/secret`: the signing secret, for a writer who asks to reveal or
 * copy it. The list never carries it. Its own per-user budget: a reveal is a read, and keying it on the
 * workspace let any writer spend the workspace's settings-write budget (and be spent by it).
 */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZWebhookIdParams },
  customRateLimitConfig: rateLimitConfigs.actions.webhookSecretReveal,
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getWebhookSecretOperation({
      authentication,
      webhookId: parsedInput.params.webhookId,
      requestId,
      instance,
    }),
});
