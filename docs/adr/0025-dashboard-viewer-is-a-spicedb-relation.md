# The Dashboard viewer is a SpiceDB relation that reaches dashboards only

The Dashboard viewer (ENG-3434) is a new `OrganizationRole` projected into SpiceDB as its own organization relation, with a workspace permission that only dashboard reads use. Survey, response, contact, Feedback Record and workspace `read` permissions never include it, so SpiceDB still denies a viewer everything else by default. This follows [ADR-0018](0018-spicedb-is-the-only-authorization-evaluator.md): SpiceDB stays the only evaluator, and no app-layer grant decides access for one role. The price is a `schema.zed` change, which self-hosters apply as an upgrade step, so 6.2 ships it as a breaking change with upgrade instructions.

## Considered Options

- **No SpiceDB relation, with an app-layer grant read from Postgres**: non-breaking for 6.2, rejected because it is a second evaluator for one role, the exact drift ADR-0018 forbids.
- **Project the viewer as `member` and block in the app**: no schema change, rejected because every check the app forgets leaks raw responses.

## Consequences

- 6.2 is a breaking release, for four reasons the release notes and the PR list: self-hosters apply the schema and run the relationship backfill as a manual step before inviting viewers; the Helm online upgrade from 6.1 to 6.2 is refused, so that upgrade runs in maintenance mode, whose hook applies the schema; `team#manage` now requires a product membership, so a billing member who is a team admin can no longer manage that team; and the v2 organization role enum gains `dashboard_viewer`.
- Existing roles never depend on the new relation or permissions, so owners, managers and members keep working on the old schema during a rolling upgrade; only viewers need the schema applied and the backfill run first.
- A viewer still reads only through dashboard-bound operations: the dashboard read, a saved chart's data on that dashboard, and its dashboard filters' value lists. The free-form chart query and field-value routes refuse viewers.
- When the Dashboards or Access Control entitlement lapses, viewers keep the role and are locked out; they are never converted to Members.
