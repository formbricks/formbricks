---
status: accepted
---

# MCP grants are stored by Formbricks; OAuth scopes are only the cap

A user's grant to an MCP client (organization & workspace access plus an access level per permission) is stored by Formbricks and read on every MCP request, not encoded in OAuth scopes (Granular MCP Access Control, ENG-7007). Access tokens are 15-minute JWTs that are never looked up, so a grant held in scopes would let a client keep a level the user just removed until the token expires. Widening would also force a re-authorize, because a refresh can only narrow its original scopes. The product asks for an Edit that applies on the client's next call without reconnecting, and only a server-side grant does that.

## Considered options

- **One OAuth scope per permission, edited through `/oauth2/update-consent`.** Rejected: a narrowed permission stays usable for up to 15 minutes, and every widening and every new permission sends the client back through `/authorize`.

## Consequences

- The scopes a client holds cap its grant: a permission can't be raised above the scope family it belongs to without reconnecting. Edit never changes the consent's scopes, so a refresh doesn't fail after an edit.
- Revoke takes effect on the next call. Before, a revoked client's JWT stayed valid for up to 15 minutes. `/api/mcp` answers 401 for a user and client without a grant row, so deleting the row is what ends the access: Revoke (consents, grant and tokens in one transaction) and every bulk end of grants (member removal, the switch to Dashboard viewer, the retention sweep, SSO recovery) need no SpiceDB call to take effect.
- A `skipConsent` client never sees the consent screen, so its grant is created when its token is issued, with the rule the migration used. Authorized apps lists it from the grant, with Edit and Revoke, capped by the scopes the client is registered with.
- A new permission inside an existing family (Creatives and Survey styling under `surveys:*`, Tags under `responses:*`) needs no OAuth migration. ADR 0011 still holds at the scope level. A new category still gets its own family, with the two data migrations from ADR 0040 (`audience:read` for contacts, segments, attributes and action classes).
- Each MCP request reads the grant together with the user and membership read it already does.
- Existing consents became grants with All access and the levels their scopes gave; new permissions started at No access. A Dashboard viewer's consent became what the consent screen offers a viewer (`dashboards:read`), whatever wider scopes it held.
- What a user may select is one rule for the consent screen and Edit: organizations they belong to other than as a billing member, and workspaces SpiceDB lets them read in those. A request that adds anything else is refused (422); an id the grant already held and the user has since lost is dropped on the next save, and not shown before it.
