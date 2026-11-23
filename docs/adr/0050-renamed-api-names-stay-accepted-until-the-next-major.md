# A renamed public API name stays accepted until the next major release

When a name in a public API v3 or MCP shape changes, both the old and the new name are accepted until the next major release (v7.0.0), never mixed in one request, stored and returned as the caller wrote them, and the old one is marked deprecated in the spec and the tool schema (ENG-7171). Workflows Part 2 is the first user: If/else operators move to the survey logic names (ADR 0046) and the email action's `includeVariables` becomes `includeEmbeddedData`. A minor release may only add to a public shape, so a rename can't remove the old name, and accepting a mix would make it unclear which name wins.

## Considered Options

- **Accept both, store and return the new name**: one stored form, but an old client reads back names it doesn't know.
- **Rename at once**: simplest, but breaks API and MCP callers in a minor release.

## Consequences

- Readers and the runner understand both name sets until v7.0.0.
- Every deprecated name is listed in one ticket (ENG-7163) so v7.0.0 removes them together and the release notes list each one.
