# Responses have their own `responses:read` and `responses:write` OAuth scopes

The response MCP tools are gated by a new `responses:*` OAuth scope family instead of `surveys:*` (ENG-2862). Responses hold respondent data, and reusing `surveys:*` would have silently given every existing survey-scoped token access to it. Creatives went the other way (ADR 0011) because they hold none. API keys calling `/api/v3/responses` are unaffected: they use workspace permissions, not scopes.

## Consequences

- Two data migrations brought existing installs along: ENG-2862 added the scopes to the MCP resource, and ENG-3470 added `responses:read` or `responses:write` to clients already registered with an MCP read or write scope, except `skipConsent` clients. Their users see one new consent screen instead of having to reconnect.
