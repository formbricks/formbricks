# Creative MCP tools reuse the surveys:read and surveys:write scopes

There is no `creatives:*` scope family (ENG-3915). Creatives hold no respondent data, and `surveys:write` can already publish an app survey on every page, so a new family wasn't worth two OAuth data migrations and a release-ordering rule before 6.2. The `surveys:*` consent label mentions creatives. Splitting later means adding `creatives:*` and granting it to every client holding `surveys:*`, as ENG-3470 did for responses.
