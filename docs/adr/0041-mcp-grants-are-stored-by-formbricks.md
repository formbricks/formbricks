---
status: proposed
---

# MCP grants are stored by Formbricks; OAuth scopes are only the cap

A user's grant to an MCP client (organization & workspace access plus an access level per permission) is stored by Formbricks and read on every MCP request, not encoded in OAuth scopes (Granular MCP Access Control, ENG-7007). Access tokens are 15-minute JWTs that are never looked up, so a grant held in scopes would let a client keep a level the user just removed until the token expires. Widening would also force a re-authorize, because a refresh can only narrow its original scopes. The product asks for an Edit that applies on the client's next call without reconnecting, and only a server-side grant does that.

## Considered options

- **One OAuth scope per permission, edited through `/oauth2/update-consent`.** Rejected: a narrowed permission stays usable for up to 15 minutes, and every widening and every new permission sends the client back through `/authorize`.

## Consequences

- The scopes a client holds cap its grant: a permission can't be raised above the scope family it belongs to without reconnecting. Edit never changes the consent's scopes, so a refresh doesn't fail after an edit.
- Revoke takes effect on the next call. Before, a revoked client's JWT stayed valid for up to 15 minutes.
- A new permission inside an existing family (Creatives and Survey styling under `surveys:*`, Tags under `responses:*`) needs no OAuth migration. ADR 0011 still holds at the scope level. A new category still gets its own family, with the two data migrations from ADR 0040 (`audience:read` for contacts, segments, attributes and action classes).
- Each MCP request reads the grant together with the user and membership read it already does.
- Existing consents became grants with All access and the levels their scopes gave; new permissions started at No access.
