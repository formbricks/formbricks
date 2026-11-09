# Every id in a response write is authorized in three layers, and a bad reference is a 422 naming the field

Twelve shipped security fixes on responses shared one shape: an id in the request body that one write path checked against the caller's workspace and another didn't (ENG-825 and ENG-1923 are the same bug on two paths). So v3 checks every reference structurally, not with one more guard someone can forget. First, a manifest declares every field that carries an id, in a `z.registry()` beside the request schema (not `.meta()`, which would leak into the published spec), with a deny-list of fields that must never appear, and a test fails when a field looks like a reference and isn't declared. Second, one workspace-scoped query per entity type checks every declared id before the write. Third, the write's own `connect` repeats the scope, so a check that loses a race still can't cross tenants. A reference that is missing or belongs to another workspace is answered with 422 `invalid_reference` naming the field and the id. Both cases come out of the same scoped query, so the answer can't tell them apart. The route's own resource (the `responseId` in the path) still gets the uniform v3 403, whether it is foreign or gone.

## Considered Options

- **A uniform 403 for a bad body reference too**: stops a caller from telling which field was wrong. That hides nothing a scoped query doesn't already hide, and makes a typo in one of five ids undebuggable.
- **Per-route guards** (v1/v2): how the twelve fixes happened.

## Consequences

- When the third layer catches a reference that moved out of scope after the check, the answer is the generic 403 instead of the 422. It is reachable only by losing that race, and the logged Prisma error says which reference it was.
- A new reference field on the request schema needs a manifest entry, or the test fails.
- `ResponseUncheckedCreateInput` (raw scalar foreign keys) and `createMany` skip the scoped `connect` and are not used on this path.
