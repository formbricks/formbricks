# The Dashboard viewer role has no SpiceDB relation

The Dashboard viewer (ENG-3434) is a new `OrganizationRole` in Postgres that projects to no relation in SpiceDB, so SpiceDB denies it every survey, response, contact, Feedback Dataset and workspace permission by default. Dashboard reads, which SpiceDB already decides on the workspace node and never projects (`UNPROJECTED_RESOURCE_TYPES`), get one app-layer grant: a Dashboard viewer may read a dashboard when one of their teams is granted its workspace. Adding a relation to `schema.zed` would force every self-hoster through a manual upgrade step, which 6.2 may not ship (see ADR-0010), and a missed check on a role mapped to an existing relation such as `member` would fail open onto raw data.

## Considered Options

- **A new `dashboard_viewer` relation in `schema.zed`**: the clean model, rejected for 6.2 as a breaking self-host upgrade. It is the expected end state in a later major.
- **Project the viewer as `member` and block in the app**: no schema change, rejected because every check the app forgets leaks raw responses.

## Consequences

- Every read a viewer makes goes through dashboard-bound operations that apply the app-layer grant: the dashboard read, a saved chart's data on that dashboard, and its dashboard filters' value lists. The free-form chart query and field-value routes refuse viewers, because their dataset check is decided in SpiceDB.
- When the Dashboards or Access Control entitlement lapses, viewers keep the role and are locked out; they are never converted to Members.
- Moving to a SpiceDB relation later means writing the relation for every existing viewer and deleting the app-layer grant in one place.
