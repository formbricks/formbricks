import "server-only";
import { WORKFLOW_WEBHOOK_DAILY_RUN_LIMIT, WORKFLOW_WEBHOOK_ORG_CALLS_PER_MINUTE } from "@/lib/constants";
import type { TRateLimitConfig } from "@/modules/core/rate-limit/types/rate-limit";

/**
 * The two Webhook trigger quotas self-hosters can raise without a release (ENG-7167). The fixed
 * per-workflow limit is `rateLimitConfigs.api.v3WorkflowWebhook`; payload caps are in
 * `@formbricks/workflows` (`webhook/limits.ts`).
 */

/** Calls per minute across one organization's Webhook workflows, keyed by organization id. */
export const workflowWebhookOrgRateLimit: TRateLimitConfig = {
  interval: 60,
  allowedPerInterval: WORKFLOW_WEBHOOK_ORG_CALLS_PER_MINUTE,
  namespace: "api:v3:workflow-webhook:organization",
};

/**
 * Runs one workflow's Secret URL may start per day, keyed by workflow id. Fails closed
 * (docs/adr/0016-abuse-limits-fail-closed.md): a run can send email and is billed, so a Redis outage
 * must not lift the cap.
 */
export const workflowWebhookDailyRunLimit: TRateLimitConfig = {
  interval: 24 * 60 * 60,
  allowedPerInterval: WORKFLOW_WEBHOOK_DAILY_RUN_LIMIT,
  namespace: "api:v3:workflow-webhook:daily-runs",
  failClosed: true,
};
