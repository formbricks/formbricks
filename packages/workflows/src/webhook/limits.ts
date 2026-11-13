/**
 * Hardcoded caps for the Webhook trigger (spec §10, ENG-7167). The two quotas self-hosters may raise
 * (organization calls per minute, runs per day per workflow) are environment variables read in
 * `apps/web`; everything here is fixed.
 */

/** Largest payload a Webhook Secret URL call or a pasted Sample payload may carry, in UTF-8 bytes. */
export const WEBHOOK_PAYLOAD_MAX_BYTES = 100 * 1024;

/** Deepest nesting a payload may have; the top-level object is level 1, and lists count as levels. */
export const WEBHOOK_PAYLOAD_MAX_DEPTH = 10;

/** How many payload paths Variable detection reads before it stops. */
export const WEBHOOK_VARIABLE_MAX_PATHS = 500;

/** Longest `Idempotency-Key` header a call may send. */
export const WEBHOOK_IDEMPOTENCY_KEY_MAX_LENGTH = 255;

/**
 * Calls per minute one workflow's Webhook Secret URL accepts (the default v3 API number). Enforced by
 * `rateLimitConfigs.api.v3WorkflowWebhook` and shown in the trigger panel, both from this constant.
 */
export const WEBHOOK_CALLS_PER_MINUTE_PER_WORKFLOW = 100;
