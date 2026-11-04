# The Dashboard viewer is a SpiceDB relation that reaches dashboards only

The Dashboard viewer (ENG-3434) is a new `OrganizationRole` projected into SpiceDB as its own organization relation, with a workspace permission that only dashboard reads use. Survey, response, contact, Feedback Record and workspace `read` permissions never include it, so SpiceDB still denies a viewer everything else by default. This follows [ADR-0018](0018-spicedb-is-the-only-authorization-evaluator.md): SpiceDB stays the only evaluator, and no app-layer grant decides access for one role. The price is a `schema.zed` change, which self-hosters apply as an upgrade step, so 6.2 ships it as a breaking change with upgrade instructions.

## Considered Options

- **No SpiceDB relation, with an app-layer grant read from Postgres**: non-breaking for 6.2, rejected because it is a second evaluator for one role, the exact drift ADR-0018 forbids.
- **Project the viewer as `member` and block in the app**: no schema change, rejected because every check the app forgets leaks raw responses.

## Consequences

- Upgrading to 6.2 requires applying the schema and running the relationship backfill before inviting viewers; the release notes and the PR carry the breaking-change entry.
- A viewer still reads only through dashboard-bound operations: the dashboard read, a saved chart's data on that dashboard, and its dashboard filters' value lists. The free-form chart query and field-value routes refuse viewers.
- When the Dashboards or Access Control entitlement lapses, viewers keep the role and are locked out; they are never converted to Members.
