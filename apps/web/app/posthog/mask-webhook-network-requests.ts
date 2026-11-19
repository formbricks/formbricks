import type { CapturedNetworkRequest } from "posthog-js";
import { redactWebhookTokens } from "@/lib/utils/redact-webhook-token";

/** `GET …/webhook`, `POST …/webhook/regenerate` and the Secret URL itself: every response can carry the URL. */
const WEBHOOK_REQUEST_PATH = /\/api\/v3\/workflows\/[^/?#]+\/webhook(?:[/?#]|$)/;

/**
 * PostHog's own body scrubbing (posthog-js `scrubPayload`), which stops running once
 * `maskCapturedNetworkRequestFn` is set, so this function has to apply it to every other request. Same words,
 * same card and social security number patterns, same replacement text as posthog-js 1.369.
 */
const PAYLOAD_CONTENT_DENY_LIST = [
  "password",
  "secret",
  "passwd",
  "api_key",
  "apikey",
  "auth",
  "credentials",
  "mysql_pwd",
  "privatekey",
  "private_key",
  "token",
];
const CARD_NUMBERS = [
  /4\d{12}(?:\d{3})?/,
  /5[1-5]\d{14}/,
  /6(?:011|5\d{2})\d{12}/,
  /3[47]\d{13}/,
  /3(?:0[0-5]|[68]\d)\d{11}/,
  /(?:2131|1800|35\d{3})\d{11}/,
];
const SOCIAL_SECURITY_NUMBER = /\d{3}-?\d{2}-?\d{4}/;

const scrubBody = (body: string | null | undefined, label: string): string | null | undefined => {
  if (body === null || body === undefined) return body;
  const trimmed = body.trim();
  const digits = trimmed.replace(/[- ]/g, "");
  if (CARD_NUMBERS.some((pattern) => pattern.test(digits)) || SOCIAL_SECURITY_NUMBER.test(trimmed)) {
    return `[SessionRecording] ${label} body redacted`;
  }
  const deniedWord = PAYLOAD_CONTENT_DENY_LIST.find((word) => body.includes(word));
  if (deniedWord) return `[SessionRecording] ${label} body redacted as might contain: ${deniedWord}`;
  return body;
};

/**
 * `session_recording.maskCapturedNetworkRequestFn`: the editor loads the Webhook Secret URL, a credential
 * (ADR 0057), as JSON, so a project that records network bodies would store it. For those requests only
 * the timing and the redacted URL stay; headers and bodies are dropped. Every other request gets PostHog's
 * default body scrubbing, which a custom mask function replaces. `ph-no-capture` covers the DOM.
 */
export const maskWebhookNetworkRequests = (request: CapturedNetworkRequest): CapturedNetworkRequest => {
  const name = redactWebhookTokens(request.name);
  if (!WEBHOOK_REQUEST_PATH.test(request.name)) {
    return {
      ...request,
      name,
      requestBody: scrubBody(request.requestBody, "Request"),
      responseBody: scrubBody(request.responseBody, "Response"),
    };
  }

  return {
    ...request,
    name,
    requestHeaders: undefined,
    requestBody: null,
    responseHeaders: undefined,
    responseBody: null,
  };
};
