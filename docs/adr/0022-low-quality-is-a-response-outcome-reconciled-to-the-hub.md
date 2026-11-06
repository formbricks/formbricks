# Low quality is a response outcome, and the Hub follows it through a reconcile job

A reviewer marks a response Low quality through one nullable `outcome` field on the response, set by `/api/v3` routes (a single PATCH and a batch route). Marking removes the response's Feedback Records from the Hub and restoring rebuilds them, done by a cleanup job that reconciles to the response's current outcome, not by direct Hub calls or by the existing deletion cleanup. The Hub is a separate service reached over HTTP, so an outage must delay the cleanup, not fail the marking. A quick mark and restore can also race a pending cleanup row, so the job reads the current outcome each time, and the existing row type assumes the response is already gone. The Feedback Record pipeline carries a stale copy of the response, so it re-reads the outcome before publishing.

## Considered Options

- **A `rejected` tag or a boolean flag** (ENG-4026, rejected responses use the Low quality outcome): rejected because Survey Script & Flow Editor adds more statuses on the same field, and a tag would need a later migration.
- **Direct synchronous Hub calls in the marking request**: rejected because a Hub outage would fail the request or leave records behind, and a restore can still race a pending cleanup row.

## Consequences

- Low quality changes only the Analysis export default, the Outcome column and filter, and Feedback Records. Summary, counts, API lists, webhooks and integrations keep counting these responses and carry `outcome`.
- New outcome values arrive as enum migrations on the same column.
