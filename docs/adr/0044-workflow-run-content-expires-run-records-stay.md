# Workflow run content expires; the run record stays

For every workflow, whatever its trigger, a run's content (payload, step input and output, run data, error text) is cleared 90 days after the run finished, while the run record (id, workflow, version, trigger type, status, timestamps) stays until the workflow is deleted (ENG-7185). Test runs are deleted entirely after 7 days and saved samples after 90 days without an update. Runs started by a Webhook trigger have no response, so the data retention sweep that removes response-started runs never reaches their payloads, which carry customer emails and names. Deleting whole runs instead would shrink the run counts that usage reports compute over any past date range.

## Considered Options

- **Delete whole runs after the period**: simplest, but usage for an older range would silently drop.
- **Keep everything**: run detail stays complete forever, but customer data from outside callers would never expire and GDPR deletions could not reach it.

## Consequences

- Run detail for an older run shows its status and timing but "Details deleted after 90 days" instead of its steps.
- The period is `WORKFLOW_RUN_DATA_RETENTION_DAYS` (default 90) and can later become a per-workspace policy in Data Retention, with the variable as its default.
