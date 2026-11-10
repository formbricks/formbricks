# List cursors are unsigned keyset positions bound to a filter fingerprint

Database-backed lists in v3 and `/api/internal` page through `apps/web/app/api/v3/lib/keyset-cursor.ts`: a keyset on the sort key plus `id`, compared as a PostgreSQL row constructor so the index serves it. The cursor is opaque base64url and unsigned, because it grants nothing: scope and filters are re-read from the request and authorized before the cursor is decoded, and its id is only ever compared, never looked up. It carries an unkeyed hash of the authorized scope and filters, so a cursor replayed under a different scope, sort or filter is a 400.

## Considered Options

- **HMAC-signed cursors**: a secret every self-hoster must hold and rotate, protecting nothing authorization doesn't already protect. None of Stripe, GitHub, Slack, Linear or the Relay spec signs theirs.
- **The OR-form keyset** (`a < $1 OR (a = $1 AND id < $2)`): rescans the range from the top on every page.

## Consequences

- If a sort ever ranges over something disclosive, such as a contact attribute, the cursor would carry it readably; the answer then is encryption, not a signature.
