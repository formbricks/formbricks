import type { CapturedNetworkRequest } from "posthog-js";
import { redactWebhookTokens } from "@/lib/utils/redact-webhook-token";

/** `GET …/webhook`, `POST …/webhook/regenerate` and the Secret URL itself: every response can carry the URL. */
const WEBHOOK_REQUEST_PATH = /\/api\/v3\/workflows\/[^/?#]+\/webhook(?:[/?#]|$)/;

/**
 * `session_recording.maskCapturedNetworkRequestFn`: the editor loads the Webhook Secret URL, a credential
 * (ADR 0057), as JSON, so a project that records network bodies would store it. For those requests only
 * the timing and the redacted URL stay; headers and bodies are dropped. `ph-no-capture` covers the DOM.
 */
export const maskWebhookNetworkRequests = (request: CapturedNetworkRequest): CapturedNetworkRequest => {
  const name = redactWebhookTokens(request.name);
  if (!WEBHOOK_REQUEST_PATH.test(request.name)) return { ...request, name };

  return {
    ...request,
    name,
    requestHeaders: undefined,
    requestBody: null,
    responseHeaders: undefined,
    responseBody: null,
  };
};
