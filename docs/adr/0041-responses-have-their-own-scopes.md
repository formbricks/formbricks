# Responses have their own `responses:read` and `responses:write` scopes

Response access uses a new `responses:*` scope family instead of `surveys:*` (ENG-2862). Responses hold respondent data, and reusing `surveys:*` would have silently given every existing survey-scoped token access to it. Creatives went the other way (ADR 0011) because they hold none.

## Consequences

- A migration grants the new scopes to OAuth clients that already hold `surveys:*` (ENG-3470), so existing integrations didn't have to register again. Splitting a family later costs the same migration.
