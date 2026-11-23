/**
 * Slack refused or failed a request: `code` is Slack's own error code (`invalid_auth`, `ratelimited`, …),
 * or `network_error` / `http_<status>` / `invalid_response` when no Slack answer could be read. Thrown only
 * for the provider's side, so a caller can tell a provider failure from a bug of ours.
 */
export class SlackApiError extends Error {
  readonly code: string;

  constructor(code: string, options?: ErrorOptions) {
    super(`Slack API error: ${code}`, options);
    this.name = "SlackApiError";
    this.code = code;
  }
}
