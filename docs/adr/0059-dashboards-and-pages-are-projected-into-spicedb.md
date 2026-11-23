# Dashboards and pages are projected into SpiceDB

Dashboard Access Control (P-ENG-110) lets a team limit its Dashboard Viewers to selected dashboards of its workspaces, and lets a dashboard page be limited to selected teams. Both are access decisions, so following [ADR-0018](0018-spicedb-is-the-only-authorization-evaluator.md) they are evaluated in SpiceDB, not in an app-layer filter: `dashboard` stops being an unprojected definition and gains a `dashboard_page` child, both projected from PostgreSQL through the authorization outbox like surveys are (ENG-3282). A team's limit only narrows its own workspace grant (D5), and page limits only narrow within a dashboard (D4): neither can grant anything the workspace grant did not.

The schema expresses "no limit means everything" without fanning out one edge per team and dashboard. A team with a limit carries a self-marker (`team#dashboard_limited`), and `team#unlimited_dashboard_member` subtracts the team's own members when the marker is present. A dashboard is readable by Dashboard Viewers through the workspace's unlimited teams, or through a team that selected it and still holds the workspace. A page is readable through its dashboard while it has no team limit (an `open_on` edge to the dashboard), or by the Dashboard Viewers of a team it is limited to who can also read the dashboard. Owners, Managers, Members and API keys keep reaching every dashboard and page through `workspace->read`.

## Considered Options

- **Filter dashboards and pages in the app from PostgreSQL**: no schema change, rejected because it is a second evaluator for one role, the drift ADR-0018 forbids, and every read path (app, link, v3, MCP, private image downloads) would need its own copy of the filter.
- **One edge per team and dashboard for unlimited teams**: simple permissions, rejected because every new dashboard and every new workspace grant would fan out writes across all teams and dashboards of the workspace.

## Consequences

- The release changes `schema.zed`, so it upgrades in a maintenance window: stop writers, run the migration (which creates an "Overview" page per dashboard and queues outbox rows for every dashboard and page), run `upgrade prepare` to apply the schema and drain the outbox, restart. There is no rolling-upgrade fallback; the upgrade steps are in `docs/self-hosting/advanced/migration.mdx`.
- Dashboard listings and page lists for Dashboard Viewers come from SpiceDB lookups. A viewer reads a chart's data, and a dashboard filter's value list, only when the chart sits on a page of that dashboard they can open.
- Image blocks are private files; the storage route also accepts read access on the page the image's widget sits on.
- `dashboard` and `dashboard_page` leave the unprojected resource types, so the backfill and scheduled reconciliation cover them.
