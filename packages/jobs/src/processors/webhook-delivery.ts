import { createMissingOverrideHandler } from "@/src/processors/missing-override";
import type { TWebhookDeliveryJobData } from "@/src/types";

/**
 * Default handle for `webhook-delivery.process`. The real delivery (SSRF-validated, signed POST) lives in
 * `apps/web` and is registered as a runtime override; this fallback only runs when no override is wired,
 * so it logs and throws rather than silently dropping the delivery.
 */
export const processWebhookDeliveryJob = createMissingOverrideHandler<TWebhookDeliveryJobData>(
  "webhook delivery",
  (data) => ({
    event: data.event,
    responseId: data.response.id,
    surveyId: data.surveyId,
    webhookId: data.webhookId,
    workspaceId: data.workspaceId,
  })
);
