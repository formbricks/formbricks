# Concurrent survey writes are guarded by an echoed `updatedAt`, not a revision or `ETag`

A survey PATCH that sends back the `updatedAt` it read is applied only if the survey hasn't changed since: a compare-and-set on `updatedAt`, with a 409 on mismatch (ENG-3069). Without it, PATCH is last-write-wins. The block endpoints rebuild the whole `blocks` array from their own read, so when the caller sends no precondition they use the `updatedAt` of that read. A token every writer already bumps is the only one nobody can bypass: a revision column only v3 increments would let the editor, v1 and every other writer change the survey without moving it.

## Considered Options

- **A `revision` field with `ETag` / `If-Match` and 412**: the standard HTTP shape, and still the intended future for headers, but it needs a column every write path bumps.
- **Hard locks**: stale locks from abandoned tabs, blocked automations, and an unlock flow to build.

## Consequences

- The precondition is opt-in on PATCH. Making it mandatory is a breaking change.
- Every write path must keep moving `updatedAt`; one that skips it breaks the guard for everyone.
