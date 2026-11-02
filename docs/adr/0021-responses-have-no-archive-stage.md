# Responses have no archive stage

A survey can be archived: hidden, read-only, restorable, and purged after 30 days. A response cannot (ENG-3345, decided 2026-09-23). Under a retention policy the notice period is the grace period, and on its last day the responses are deleted for good; export is the only way back. "Archive, then delete" applies to surveys only, whose responses go with the survey.

## Considered Options

- **A `Response.archivedAt` flag that hides archived responses**: every read path would have to filter, including summary, table, exports, three API versions, MCP, the Hub sync, quotas and targeting, and v2 reads whole rows, so the column would leak there by default.
- **Archive as a snapshot file**: invents a new artefact and a restore flow nobody asked for.

## Consequences

- There is no archive column on `Response`, the largest table.
- Deleting responses reopens quotas, revives used single-use links and can re-show app surveys to people who answered; the delete path (`deleteScopedResponses`) handles displays and files.
- Response restore is revisited when a customer asks for it.
