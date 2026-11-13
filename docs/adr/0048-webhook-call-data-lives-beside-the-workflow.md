# A Webhook trigger's token lives on the workflow; its call data lives beside it

The Webhook Secret URL token is stored on the `Workflow` row as a hash (to look calls up) and an encrypted copy (so the editor can show the URL again); it is never part of the workflow definition (ENG-7166). The definition is copied into every version, every duplicate and the audit log, so a token there would leak into all of them, and Regenerate would need a new version. Per-call data (the last sample payload, the last call's time and IP, and the last Test request response of each HTTP request) lives in a separate `WorkflowSample` table. Writing it to `Workflow` would bump `updatedAt` on every call, reshuffling the workflow list sorted by last update and its page cursors, and would compete with the editor's autosave on the same row.

## Considered Options

- **Derive the sample from the last run**: no new table, but a call to a draft workflow, a pasted sample and a Test request response have no run.
- **A JSON column on `Workflow`**: no new table, but the per-call writes above.

## Consequences

- Duplicating a workflow copies none of it; the copy gets a new token.
- Run detail reads the caller's IP from the run itself (`WorkflowRun.callerIp`), not from the sample.
