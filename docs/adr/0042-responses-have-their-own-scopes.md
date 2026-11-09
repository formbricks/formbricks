# Responses have their own `responses:read` and `responses:write` scopes

Response MCP tools and API access use a new `responses:*` scope family instead of reusing `surveys:*` (ENG-2862). Responses hold respondent data, and widening `surveys:*` would have silently given every existing survey-scoped token access to it. The new scopes are added by their own migration rather than by editing the seed migration. A later migration grants them to OAuth clients that already hold `surveys:*` (ENG-3470), so existing integrations keep working without registering again.

## Considered Options

- **Reuse `surveys:*`**: no migration and no client changes, but it widens every existing grant to include respondent data.
- **New scopes with no grant to existing clients**: the authorization server checks `/authorize` against the scopes a client registered with, so every connected client would get `invalid_scope` until it registered again.

## Consequences

- Creatives went the other way and reuse `surveys:*` (ADR 0011), because they hold no respondent data. Splitting a family later costs the same pair of migrations.
