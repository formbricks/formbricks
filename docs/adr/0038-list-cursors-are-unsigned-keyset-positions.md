# List cursors are unsigned keyset positions bound to a filter fingerprint

Database-backed lists in v3 and `/api/internal` (responses, contacts, charts, contact attribute keys, retention runs and exemptions) page through `apps/web/app/api/v3/lib/keyset-cursor.ts`: a keyset on the sort key plus `id`, compared as a PostgreSQL row constructor (`(created_at, id) < ($1, $2)`) so the index serves it. Prisma's query API can't write that comparison, so the helper uses raw SQL. The cursor is opaque base64url and unsigned. It grants nothing: the scope and filters are re-read from the request and authorized before the cursor is decoded, and its id is only ever compared, never looked up. It carries an unkeyed SHA-256 prefix of the authorized scope and the normalized filters, and a cursor replayed under a different scope, sort or filter is a 400 naming `cursor`. Page size is deliberately left out of that fingerprint, since a client may change it between pages (AIP-158).

## Considered Options

- **HMAC-signed cursors**: a secret every self-hoster must hold and rotate, protecting nothing authorization doesn't already protect. None of Stripe, GitHub, Slack, Linear, Shopify or the Relay spec signs theirs.
- **The OR-form keyset** (`created_at < $1 OR (created_at = $1 AND id < $2)`): what the earlier helpers did. It rescans from the top of the range on every page.
- **Offset pagination** (v1/v2): rows shift between pages, and deep pages cost a scan.

## Consequences

- If a future sort ranges over something disclosive, such as a contact attribute, the cursor would carry that value readably. The answer then is encryption (AEAD), not a signature.
- Responses cap `totalCount`, which is opt-in, at 10 000 and report `totalCountRelation` (`eq` or `gte`, Elasticsearch's convention). An exact count measured 87–3950 ms against a 1.4–3.6 ms page. `/responses/count?precision=exact` is the slow path, and it needs a survey or contact to anchor it.
