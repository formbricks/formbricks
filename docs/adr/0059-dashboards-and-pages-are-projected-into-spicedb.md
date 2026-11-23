# Dashboards and dashboard pages are projected into SpiceDB

A team can limit its Dashboard Viewers to selected dashboards, and a dashboard page can be limited to selected teams (Dashboard Access Control, P-ENG-110). Both limits are SpiceDB relations on newly projected `dashboard` and `dashboard_page` resources. They are not Postgres filters applied after the workspace check, because [ADR-0018](0018-spicedb-is-the-only-authorization-evaluator.md) keeps SpiceDB the only evaluator, and D4 makes a limited page a real boundary in the app, by direct link and through API and MCP. This reverses the earlier choice to leave dashboards unprojected (`UNPROJECTED_RESOURCE_TYPES`), which [ADR-0010](0010-workspace-level-authorization.md) and [ADR-0025](0025-dashboard-viewer-is-a-spicedb-relation.md) relied on, where access stopped at `workspace#dashboard_read`.

## Considered Options

- **Keep dashboards unprojected and filter dashboards and pages in Postgres after the workspace check**: no `schema.zed` change, rejected because team and page limits would be a second evaluator for one role, and listings, MCP and View as would each have to apply it.

## Consequences

- A person's dashboard and page access is the union of their teams' grants. A team without a dashboard limit reaches every dashboard in its workspaces, as today. A page with no team limit is open to everyone who can open its dashboard. A page limit only narrows a dashboard; it never grants one.
- Limits bind only Dashboard Viewers. Owners, Managers and the Member role keep reaching every dashboard and page through `workspace#read`.
- Self-hosters apply the new schema with `formbricks-authzed upgrade prepare`, the step every schema-changing release already needs, because the app never writes `schema.zed` itself and SpiceDB refuses relationships its schema does not declare.
- Existing dashboards were never projected, and the outbox only carries writes made after its triggers exist, so every existing dashboard and its new Overview page has to be projected once, or a fail-closed check would deny every Dashboard Viewer. The migration that creates the Overview pages also queues their outbox rows, so the normal outbox delivery does this copy and no separate backfill command is needed.
