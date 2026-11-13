/**
 * The token segment of a Webhook Secret URL (`…/api/v3/workflows/{id}/webhook/{token}`), which is a
 * credential (ADR 0041). Matches anywhere in a string, so it works on a pathname, a full URL with a
 * base path or query, or a log or error message; `webhook/regenerate` is an operation, not a token.
 */
const WEBHOOK_TOKEN_SEGMENT =
  /(\/api\/v3\/workflows\/[^/?#\s]+\/webhook\/)(?!regenerate(?:[/?#\s]|$))[^/?#\s]+/g;

export const REDACTED_WEBHOOK_TOKEN = "[redacted]";

/** Replaces every Webhook Secret URL token in `value` with `[redacted]`. */
export const redactWebhookTokens = (value: string): string =>
  value.replace(WEBHOOK_TOKEN_SEGMENT, `$1${REDACTED_WEBHOOK_TOKEN}`);
