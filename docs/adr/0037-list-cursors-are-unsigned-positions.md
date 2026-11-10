# List cursors are unsigned positions bound to a filter fingerprint

The shared v3 cursor helpers (`apps/web/app/api/v3/lib/keyset-cursor.ts` and `sort-cursor.ts`, used by `/api/internal` lists too) mint opaque base64url cursors that are not signed. A cursor grants nothing: every request authorizes its scope from the query, and the cursor only says where the last page ended. It carries the sort it was issued for and an unkeyed hash of the scope and filters, so replaying it under a different sort or filter set is a 400 naming `cursor`. The helper's page predicate compares the sort key and `id` as a PostgreSQL row constructor (`(created_at, id) < ($1, $2)`) so the index serves it.

## Considered Options

- **HMAC-signed cursors**: a secret every self-hoster must hold and rotate, protecting nothing authorization doesn't already protect. None of Stripe, GitHub, Slack, Linear or the Relay spec signs theirs.
- **The OR-form keyset** (`a < $1 OR (a = $1 AND id < $2)`): rescans the range from the top on every page.

## Consequences

- New lists use these helpers. Some older lists still page with the OR form or a cursor of their own.
- If a sort ever ranges over something disclosive, such as a contact attribute, the cursor would carry it readably; the answer then is encryption, not a signature.
