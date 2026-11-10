# A v3 survey is one strict document, and PATCH replaces whole top-level fields

`/api/v3/surveys` reads and writes a survey as a single block-based document, not as survey, block and question sub-resources: a survey is valid or invalid as a whole (element ids are unique across blocks, logic jumps between them), and one complete object is what agents generate best. PATCH is a strict top-level partial: an omitted field is kept, and a provided object or array replaces that whole subtree, so an id missing from a replaced array is a deletion (within the publish-time locks of ADR 0020). Unknown keys are refused at every nesting level. The API never repairs references for the caller: a write that leaves one pointing at nothing is a 422 naming the path, because a silent repair hides the mistake and may guess the wrong target.

## Considered Options

- **Block or question sub-resources**: smaller writes, but cross-block logic stays global, and an agent coordinating many dependent writes fails halfway more often.
- **JSON Patch or deep merge**: harder for clients to produce correctly, and a deep merge can't express removing an array entry.

## Consequences

- Targeted edits are operations, not CRUD: `PATCH /surveys/{id}/blocks` applies an atomic list of `insert`/`update`/`remove` ops and `PUT /surveys/{id}/blocks/order` sets the order (ENG-3069), through the same write path as PATCH.
- There is no rename operation, and the server can't tell a rename from a delete plus a create; a caller applies a rename to every reference in the same write.
- Stale overwrites are the cost of whole-subtree writes; ADR 0036 covers them.
