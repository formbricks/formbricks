# Concurrent survey writes are guarded by an echoed `updatedAt`, not a revision or `ETag`

A survey PATCH that sends back the `updatedAt` it read is applied only if the survey hasn't changed since. The write is a compare-and-set on `updatedAt`, and a mismatch is a 409 carrying the expected and current values (ENG-3069). Without it, PATCH stays last-write-wins. The block endpoints take `expectedUpdatedAt`. When it is missing, they use the `updatedAt` of the survey the request itself read, because they rebuild the whole `blocks` array from that read: a concurrent write then gets a 409 instead of silently losing a block. Survey writes do race: the editor autosaves every 10 seconds, and a user, a second tab and an agent can all edit the same survey. A token every writer already bumps is the only one that can't be bypassed. A revision column only v3 increments would let the editor, v1 and every other writer change the survey without moving it, which is worse than no token at all. `CODING_STANDARDS.md` makes the same compare-and-set the rule for other writes that can race.

## Considered Options

- **A `revision` field with `ETag` / `If-Match` and 412**: the standard HTTP shape, and still the intended future for headers. It needs a column every write path bumps.
- **Hard locks**: stale locks from abandoned tabs, blocked automations, and an unlock flow to build.
- **Presence warnings alone**: useful in the UI, but they don't stop an overwrite through the API.

## Consequences

- The precondition is opt-in on PATCH, so a client that ignores it can still overwrite a concurrent edit. Making it mandatory is a breaking change.
- DELETE has no precondition.
- `updatedAt` must keep moving on every write path. A write that skips `@updatedAt` breaks the guard for everyone.
