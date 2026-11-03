# Abuse limits fail closed when Redis is down; throughput limits fail open

The application rate limiter keeps its counters in Redis. When it cannot reach Redis, a limit marked `failClosed` refuses the request and every other limit lets it through unchecked (ENG-3828). Three groups are marked, because each is the only thing between an attacker and something we cannot take back:

- **Email-sending.** Every limit in `sendEmail`'s `applyEmailRateLimits`, plus forgot-password, verification resend, email change, invites, follow-ups, account deletion and the link-survey email. A Redis outage must not reopen INC-5, where a script sent about 13,000 invite emails and damaged our sender reputation.
- **Account and organization creation.** Sign-up and organization creation. Throwaway accounts and organizations are how INC-5 got fresh per-organization budgets.
- **Brute-force guards.** Survey PIN, password-reset and email-change token redemption, the email-token endpoint (which reveals whether an address is registered), and failed MCP authentication.

Throughput limits (the v1/v2/v3 and client APIs, `stateMutation`, storage, custom CSS), AI and paid-API spend, and the SAML callback stay fail-open. Refusing those would turn a Redis blip into a full outage of the app and of every customer's surveys, and none of them guards an irreversible abuse. The cost of failing closed is small: Redis is already required at boot, and sign-up verification tokens and response processing (BullMQ) stop working without it anyway.

## Consequences

- A refused request gets the ordinary `TooManyRequestsError` (429, "try again later", no `Retry-After`), so every caller already handles it. Better Auth's `sendVerificationEmail` hook swallows that error, but the per-IP sign-up and resend limits refuse first.
- An outage is no longer silent: every check that cannot reach Redis logs `Redis unavailable` or `Rate limit check failed` at error level and counts `formbricks_rate_limiter_unavailable_total{fail_mode, reason}`. That counter is the signal for paging on-call, but no alert pages anyone from it yet: ENG-3828 stays open until a SigNoz alert does. It only moves when Redis refuses or drops the connection. The limiter's `eval` has no command timeout, so a Redis that hangs stalls each request instead, and nothing is logged or counted.
- `RATE_LIMITING_DISABLED=1` still turns every limit off, including these.
- A new limit fails open unless it sets `failClosed: true`. Decide which group it belongs to when you add it.
