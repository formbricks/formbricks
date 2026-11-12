---
status: accepted
---

# The Webhook Secret URL is the Webhook trigger's only credential

A Webhook trigger accepts any POST to its Webhook Secret URL, as Slack and Discord incoming webhooks do, with no header token or signature, because data-layer and ETL tools can call a URL without code but cannot sign. The URL is a capability URL (W3C TAG, "Good Practices for Capability URLs"): holding it proves possession, not that the request came from the intended system. So it is handled like an API key: a 128-bit random token checked against a stored hash, HTTPS and POST only, rate-limited per workflow, never written to logs, error reports, analytics or session recordings, shown only to people who can edit the workflow, and replaceable at once with Regenerate without deleting the workflow. Email actions stay within the organization's send caps, and an email to a payload address must have a fixed body.

## Considered Options

- **A header token**: one more secret to paste, which many no-code callers cannot set, for little gain over a URL that is already secret.
- **Signed requests (HMAC)**: the strongest option, but most ETL and data-layer tools cannot compute a signature without custom code, which is what customers are trying to avoid.

## Consequences

- Authentication can be extended later without breaking existing callers: an optional bearer-token header for more controlled integrations, then HMAC signatures for sender verification and replay protection (ENG-7118). The Secret URL stays the default.
- Because the token travels in the path, every layer that records request paths (application logs, error reporting, the edge proxy's access logs) must redact it.
