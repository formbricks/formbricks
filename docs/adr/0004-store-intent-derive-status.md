# Store the author's intent, derive the status people see

A creative stores only what its author chose (`draft · inProgress · paused · completed`, plus `archivedAt` and `publishedAt`; ENG-3690, ENG-3914). Scheduled, Active, Paused with its survey and Closed after the end time come from one function, with a SQL twin for list filters. Nothing writes to creatives when a survey pauses, and no cron flips statuses: survey status has 8+ writers, so a cascade would miss some.

## Consequences

- The API exposes a writable `status` and a read-only `displayStatus` + `displayStatusReason`.
