import "server-only";
import { logger } from "@formbricks/logger";
import { DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS, WEBHOOK_DELIVERY_TIMEOUT_MS } from "@/lib/constants";
import { generateStandardWebhookSignature } from "@/lib/crypto";
import { createPinnedDispatcher, validateAndResolveWebhookUrl } from "@/lib/utils/validate-webhook-url";

/** The receiver did not answer within the delivery timeout. */
export class WebhookDeliveryTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Webhook request timed out after ${timeoutMs}ms`);
    this.name = "WebhookDeliveryTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export interface SendSignedWebhookRequestInput {
  url: string;
  /** Already-serialized JSON — the signature covers these exact bytes. */
  body: string;
  /** Standard Webhooks `webhook-id`. Callers own its derivation (stable across retries for deliveries). */
  messageId: string;
  secret?: string | null;
  timeoutMs?: number;
}

export interface SendSignedWebhookRequestResult {
  statusCode: number;
}

type WebhookFetchOptions = RequestInit & {
  dispatcher?: ReturnType<typeof createPinnedDispatcher>;
};

/** Returns the URL's host for log lines: webhook URLs often carry capability tokens in path or query. */
export const getWebhookUrlHost = (url: string): string | undefined => {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
};

const fetchWithTimeout = async (
  url: string,
  options: WebhookFetchOptions,
  timeoutMs: number
): Promise<Response> => {
  const abortController = new AbortController();
  const timeoutError = new WebhookDeliveryTimeoutError(timeoutMs);
  const timeoutId = setTimeout(() => {
    abortController.abort(timeoutError);
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: abortController.signal,
    } as RequestInit);
  } catch (error) {
    // undici rejects with the abort reason, but a caller-provided fetch may throw its own AbortError;
    // either way the timer firing is what happened.
    if (abortController.signal.aborted) {
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * The one way Formbricks POSTs to a webhook URL — used by background deliveries and the "test endpoint"
 * button alike, so the SSRF regime, signing and timeout can never drift between the two.
 *
 * Every call re-validates the URL and pins the TCP connection to the validated address (closing the
 * DNS-rebinding window between check and connect), signs the body in the Standard Webhooks format when a
 * secret is present, and refuses to follow redirects unless the operator opted into
 * `DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS` — with `redirect: "manual"` undici returns the actual 30x,
 * which the caller then classifies.
 *
 * Any completed exchange resolves with its status code, including 3xx/4xx/5xx: what counts as a failure
 * and whether it is worth retrying is the caller's decision. It throws only when no exchange completed —
 * `InvalidInputError` (URL rejected; `WebhookDnsResolutionError` for a resolver failure),
 * `WebhookDeliveryTimeoutError`, or the network error from `fetch`.
 */
export const sendSignedWebhookRequest = async ({
  url,
  body,
  messageId,
  secret,
  timeoutMs = WEBHOOK_DELIVERY_TIMEOUT_MS,
}: SendSignedWebhookRequestInput): Promise<SendSignedWebhookRequestResult> => {
  const address = await validateAndResolveWebhookUrl(url);
  // `address` is null only when the operator allows internal URLs and the host is a blocked name
  // resolved via /etc/hosts — nothing to pin in that case.
  const dispatcher = address ? createPinnedDispatcher(address) : undefined;
  const redirect: RequestRedirect = DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS ? "follow" : "manual";

  const timestamp = Math.floor(Date.now() / 1000);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "webhook-id": messageId,
    "webhook-timestamp": timestamp.toString(),
  };
  if (secret) {
    headers["webhook-signature"] = generateStandardWebhookSignature(messageId, timestamp, body, secret);
  }

  try {
    const response = await fetchWithTimeout(
      url,
      { method: "POST", headers, body, redirect, dispatcher },
      timeoutMs
    );
    return { statusCode: response.status };
  } finally {
    // destroy(), not close(): close() drains gracefully and would hang on a receiver that accepted the
    // TCP connection but never answered. Cleanup failures must not mask the delivery outcome.
    try {
      await dispatcher?.destroy();
    } catch (cleanupError) {
      logger.warn(
        { err: cleanupError, webhookUrlHost: getWebhookUrlHost(url) },
        "Webhook request dispatcher cleanup failed"
      );
    }
  }
};
