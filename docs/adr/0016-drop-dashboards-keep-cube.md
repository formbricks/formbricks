---
status: proposed
---

# Drop dashboards and charts, keep Cube as the agent query layer

Dashboards, charts, widgets and their tables are deleted, with the builder, renderer and AI chart generation. Cube stays, and agents read it through one read-only feedback query operation and MCP tool in the Cube query format and field catalog of ADR 0001. With no human UI to draw charts, a saved chart has no reader, while the query layer is what lets an agent answer questions over a Feedback Dataset.

This supersedes ADR 0002, since the app no longer has dashboards to call the public API. ADR 0001 still holds for the query format: renaming or splitting the `FeedbackRecords` Cube model remains a breaking API change.

Neither earlier ADR was fully built in this checkout. Charts and widgets only ever ran through server actions, never `/api/v3`, and the public-caller validation ADR 0001 describes (members checked against the field catalog, bounded filters and `limit`) did not exist. `POST /api/v3/feedback-queries` is the first place both are real.

## Considered Options

- **Keep the Chart entity as a stored query agents re-run**: rejected for now; an agent can hold the query itself and nothing else reads it.
- **Delete Cube too**: rejected because agents would lose aggregation and have to page raw records.

## Consequences

- A migration drops the Chart and Dashboard tables and their widget rows.
- The Cube service, its secrets and the field catalog stay in the deployment files.
- The query route is gated by the old `dashboards` licence feature key, which needs a new name or a fold into `feedbackDirectories` when the dashboards code is deleted.
