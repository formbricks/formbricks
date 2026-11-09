# Survey ids live in the document, a missing id is a deletion, and the API never repairs references

Block, element, variable and hidden-field ids are part of the survey document and have no endpoints of their own. Callers may supply them on create, and the server generates missing block and variable ids. On update, the submitted document is the state: an id missing from a replaced array is deleted, a new id is created, and the server cannot tell a rename from a delete plus a create. There is no rename operation. A caller who renames something applies the rename to every reference in the same PATCH. A write that leaves a reference pointing at nothing (logic operands, recall, `jumpToBlock`, `requireAnswer`, `logicFallback`, `calculate`) is refused with 422 `dangling_reference` naming the path. The server never rewrites references for the caller, because a silent repair hides the mistake and might guess the wrong target. An element id can change only while the survey is a draft or the element is a draft element (`immutable_identifier` otherwise), the same rule as the editor: responses are keyed by element id (ADR 0021), so an API caller can't do more damage than the editor.

## Considered Options

- **Dedicated rename operations** (`renameElement`, `renameVariable`): safer for one rename, but a second write model next to PATCH. Left to a future batch-operations endpoint.
- **Cascade renames server-side**: needs the server to guess intent from a diff it can't disambiguate.

## Consequences

- Renaming a variable is allowed and can break downstream exports and integrations keyed by its name. The contract says so instead of refusing it.
- Quotas and follow-ups reference the same ids, but they live outside the survey document, and v3 doesn't update them.
- Option text, answer codes and question codes have their own publish-time locks (ADR 0020, ADR 0021).
