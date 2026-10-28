---
status: proposed
---

# Drop dashboards and charts, keep Cube as the agent query layer

Dashboards, charts, widgets and their tables are deleted, with the builder, renderer and AI chart generation. Cube stays, and agents read it through one read-only feedback query operation and MCP tool in the Cube query format and field catalog of ADR 0001. With no human UI to draw charts, a saved chart has no reader, while the query layer is what lets an agent answer questions over a Feedback Dataset.

This supersedes ADR 0002, since the app no longer has dashboards to call the public API. ADR 0001 still holds for the query format: renaming or splitting the `FeedbackRecords` Cube model remains a breaking API change.

## Considered Options

- **Keep the Chart entity as a stored query agents re-run**: rejected for now; an agent can hold the query itself and nothing else reads it.
- **Delete Cube too**: rejected because agents would lose aggregation and have to page raw records.

## Consequences

- A migration drops the Chart and Dashboard tables and their widget rows.
- The Cube service, its secrets and the field catalog stay in the deployment files.
