# A v3 survey is one strict document, and PATCH replaces whole top-level fields

`/api/v3/surveys` creates, reads, updates and deletes a survey as a single block-based document, not as survey, block and question sub-resources. A survey is valid or invalid as a whole: element ids are unique across blocks, logic jumps between blocks, and endings, hidden fields and variables are referenced from anywhere, so separate block endpoints would still need survey-wide validation and transactions while adding round trips and partly-invalid states. One complete object is also what agents generate best. PATCH is a strict top-level partial: an omitted field is kept, and a provided object or array replaces that whole subtree, with no deep merge and no JSON Patch. Unknown keys are refused at every level, nested objects included, because silently dropping a typo returns a confidently wrong survey. A schema failure is a 400; a valid shape that breaks a survey rule is a 422 naming the path. What GET returns can be sent straight back: server-owned fields are accepted, an echoed value is a no-op, and a changed one is a 422 `read_only_field`.

## Considered Options

- **Block or question sub-resources**: smaller writes, but cross-block logic stays global, ordering gets its own semantics, and an agent coordinating many dependent writes fails halfway more often.
- **JSON Patch or deep merge**: harder for clients and agents to produce correctly, and a deep merge can't express removing an array entry.
- **Reject server-owned fields on PATCH**: makes every client strip fields from what it just read.

## Consequences

- Targeted edits go through operations, not CRUD: `PATCH /surveys/{id}/blocks` applies an ordered, atomic list of `insert`/`update`/`remove` ops and `PUT /surveys/{id}/blocks/order` sets the order (ENG-3069). Both run through the same write path and validation as PATCH.
- Large payloads and stale overwrites are the cost. The `updatedAt` precondition covers the second (ADR 0037).
- Surveys still in the legacy question-based shape are refused, not translated.
- `type` is set on create and immutable after. Archive and restore are their own operations, separate from DELETE.
- `POST /surveys/validate` runs the same checks without writing and reports what a write would do (for example the languages it would create), so an agent can check before it commits.
