# Formbricks Authorization Schema (AuthZed / SpiceDB)

This directory contains the canonical SpiceDB schema for Formbricks and its
assertion-based validation suite.

- `schema.zed` — the canonical, non-composable authorization schema
  (`use typechecking`).
- `schema-validation.yaml` — relationships, assertions, and expected-relations
  blocks that pin down the schema's semantics.
- `validate.sh` — offline validation runner (local `zed` binary or the pinned
  `authzed/zed` container image; no SpiceDB server needed).

## Running the validation

```bash
pnpm authzed:validate
```

CI runs the same script on every pull request as part of `.github/workflows/pr.yml`.
The validation job is a dependency of the required `PR Check Summary`, so a
failing assertion blocks the change: it means the schema no longer matches the
documented semantics.

## Checking and applying the schema

Schema deployment is an explicit operational action. Formbricks never writes a
schema during application startup, database migration, health checks,
readiness, or Helm reconciliation.

Configure the normal server-only AuthZed variables, then check the connected
SpiceDB instance without changing it:

```bash
pnpm authzed:schema check
```

The command compares the checked-in schema with SpiceDB semantically by using
the AuthZed schema-diff API. It does not compare raw formatted text. A matching
schema exits `0`; drift exits `2`. Both cases print exactly one sanitized JSON
object containing source and remote SHA-256 digests and aggregate difference
counts. Schema contents and changed object names are never printed.

An empty SpiceDB installation can be initialized explicitly:

```bash
pnpm authzed:schema apply
```

Replacing a non-empty schema requires the exact remote digest returned by the
immediately preceding check:

```bash
pnpm authzed:schema apply \
  --expected-current-digest sha256:<digest-from-check>
```

This guards against applying over a schema the operator did not inspect.
The digest precondition is not atomic because SpiceDB schema writes do not support compare-and-swap, so ensure
there is no concurrent schema writer between `check` and `apply`.
`apply` exits `0` only after reading the schema back and confirming that its
semantic diff is empty. Applying an already matching schema returns
`status: "unchanged"` without issuing another write. Invalid configuration,
transport failures, digest mismatches, unsafe SpiceDB schema changes, and
read-back failures exit `1` with a stable `authzed_*` code.

The command loads the repository `.env`. For an external TLS endpoint use a
bare `host:port` with `AUTHZED_INSECURE=false`; internal Docker or Kubernetes
plaintext endpoints use `AUTHZED_INSECURE=true`. Restart long-running
Formbricks processes after changing AuthZed environment values.

### Backups and rollback

Before replacing any non-empty schema:

1. Export the current schema with the pinned `zed` CLI.
2. Export relationships that depend on definitions or relations being removed.
3. Store both files with mode `0600`.
4. Run `check` and retain its remote digest.
5. Apply only the reviewed canonical schema.

Rollback is safe only while no relationships depend on definitions introduced
by the new schema. Once relationships exist, do not force a downgrade. Use an
expand, backfill, and contract migration so every intermediate schema accepts
the stored relationships.

## Guiding principle: mirror the current system

The engine-independent application contract in
`apps/web/lib/authorization` is the source of truth for Formbricks actor,
action, and resource types. This SpiceDB schema is a downstream implementation
of that contract; application types must never be generated from SDK or schema
types.

The schema is a **technical migration of the current Formbricks authorization
system**. It models exactly what the application enforces today — no future
capabilities, no permission changes. A principal must never gain or lose access
because a check moved from application code into this schema.

Any schema change must keep `pnpm authzed:validate` green and extend the
assertions to document the new semantics. Intentional semantic changes require
updating the assertions in the same PR, with review.

## Organization membership projection

PostgreSQL remains the source of truth for membership lifecycle and roles.
After a `Membership` source mutation commits, Formbricks reconciles the
corresponding SpiceDB `organization` relationship:

- `Membership.role` maps exhaustively to exactly one of `owner`, `manager`,
  `member`, or `billing`.
- A present membership atomically touches its current role and deletes the
  other three roles.
- A deleted membership deletes all four possible role relationships.
- Repeating the same create, update, or delete is safe and can heal a missed
  projection.
- If the source role changes concurrently, reconciliation reads PostgreSQL
  again and converges for up to three passes.

The current legacy evaluator authorizes every `Membership` row without checking
`Membership.accepted`. The initial projection deliberately preserves that
behavior: accepted and pending membership rows project identically. An
`Invite` alone is not projected.

Projection runs after the source transaction commits and is best-effort.
AuthZed being disabled performs no projection work. An AuthZed outage never
changes a successful PostgreSQL mutation into an application error; it produces
only a sanitized operational result and warning. Existing records and any drift
an outage leaves behind are reconciled by `pnpm authzed:backfill` (see
[Backfill and repair](#backfill-and-repair)), which must report a clean run
before AuthZed shadow evaluation or enforcement is enabled.

The organization-membership projection boundary covers:

- the shared `createMembership` service, including idempotent retries;
- SSO provisioning after its outer transaction commits;
- organization role updates and explicit membership deletion;
- API v2 organization-user nested membership creation and role updates;
- organization deletion and both legacy and Better Auth user-deletion
  cascades.

User deletion removes both organization-role and team-role relationships for
the deleted user. API-key projection is described separately below because API
keys are independent authorization subjects rather than user-owned role edges.

The application facade accepts only Formbricks-owned relationship types. It
supports idempotent `touch`/`delete` batches of at most 1,000 updates and safely
narrowed bulk deletions. The SDK client, credentials, SDK request/response
types, and raw errors never cross the facade. Relationship identifiers are
write-only inputs and never appear in projection results or logs.

## Team membership and workspace-grant projection

PostgreSQL also remains authoritative for team and workspace access. After a
source mutation commits, Formbricks reconciles the affected graph:

- `Team.organizationId` touches `team#organization@organization`.
- `TeamUser.role` maps exhaustively to exactly one `team#admin@user` or
  `team#contributor@user` relationship and deletes the alternate role.
- `Workspace.organizationId` touches
  `workspace#organization@organization`.
- `WorkspaceTeam.permission` maps exhaustively to exactly one
  `workspace#reader_team`, `workspace#writer_team`, or
  `workspace#manager_team` relationship with a `team#member` subject, deleting
  the two alternate grants.

Formbricks never precomputes a user's highest workspace permission. SpiceDB
unions every team grant at evaluation time, preserving the current
`read < readWrite < manage` ladder when a user belongs to multiple teams.

Reconciliation deduplicates targets, reads a complete PostgreSQL snapshot, and
writes logical relationship groups sequentially in requests of at most 1,000
updates. A role's two updates or a workspace grant's three updates are never
split across requests. The projector re-reads the source and retries the
complete snapshot for up to three passes when it changes concurrently.

Team membership writes inside SSO transactions use an explicit deferred mode.
The enclosing service reconciles only after the outer transaction commits.
Multi-step nontransactional flows, including invite assignment and workspace
creation, remember each committed source target and reconcile it in `finally`;
an AuthZed failure never replaces the original source result.

Deletion cleanup is deliberately two-sided and idempotent:

- a missing team deletes its resource relationships and every workspace grant
  where that `team#member` is the subject;
- a missing workspace deletes all relationships on that workspace resource;
- user deletion removes user-subject relationships from organization and team
  resources;
- organization deletion captures its team and workspace IDs before the
  PostgreSQL cascade, then removes organization, team, workspace, and
  team-as-subject workspace edges.

Projection covers UI and API team creation/update/deletion, workspace
creation/deletion, API v2 workspace-team CRUD, invite/signup/SSO team
assignment, organization-role promotions, membership removal, API v2 nested
organization-user team changes, and user/organization cascades. Existing records
are not backfilled by these hooks; `pnpm authzed:backfill` covers them.

## API-key scope projection

PostgreSQL remains authoritative for API-key ownership and access. After API
key creation commits, Formbricks reconciles:

- `ApiKey.organizationId` to `api_key#organization@organization`;
- `organizationAccess.accessControl.read` to
  `organization#api_key_reader@api_key`;
- `organizationAccess.accessControl.write` to
  `organization#api_key_writer@api_key`;
- `ApiKeyWorkspace.permission` (`read`, `write`, or `manage`) to exactly one
  `workspace#reader`, `workspace#writer`, or `workspace#manager` relationship
  whose subject is the API key.

The organization-access flags are independent. Missing, malformed, or
non-boolean JSON values are treated as `false`, matching the current evaluator.
Each workspace scope touches its selected relation and deletes the other two,
so repeating a write is idempotent and a lower permission removes any stale
higher grant.

API-key scopes are selected during creation and are not editable today. Label
and `lastUsedAt` updates do not affect authorization and therefore do not
project. There is no separate revoked state in the current data model: deleting
an API key is revocation.

Deletion cleanup removes every relationship on the API-key resource and every
organization or workspace relationship where the API key is the subject.
Organization deletion captures API-key IDs before PostgreSQL cascades and then
performs the same idempotent cleanup. Workspace deletion is already covered by
the workspace projector, which deletes every relationship on the missing
workspace resource.

The projector reads only IDs, organization access, and workspace permissions;
it never reads or logs plaintext keys, hashes, lookup hashes, creator metadata,
or usage timestamps. Reconciliation uses the same post-commit, best-effort,
three-pass convergence and bounded batching contract as organization, team,
and workspace projection.

Existing API keys are not backfilled by mutation hooks; `pnpm authzed:backfill`
covers them, including a scope revoked outside a hook, which the projector alone
cannot see. Routing API-key principals through the central interface remains
ENG-1731, and SpiceDB comparison/cutover remains ENG-1738.

## Resource parent resolution during the current-model migration

The initial migration deliberately does not project one relationship for every
survey, dashboard, and response. ENG-1738's private shadow evaluator must use
the existing server-only PostgreSQL resolvers to map:

- a survey or dashboard to its workspace;
- a response to its survey, then to its workspace.

It then checks the equivalent workspace permission in SpiceDB. This preserves
the current authorization boundary and avoids adding a high-cardinality
`response#survey` projection to every response mutation before shadow mode.
Resolver database failures remain operational errors and missing resources
remain denials, matching the legacy evaluator.

The `survey#workspace`, `dashboard#workspace`, and `response#survey` relations
remain in the schema for later resource-level sharing. They must not be queried
directly until a future projector and matching backfill scope cover those edges;
the backfill classifies them as ignored today and never prunes them.
Phase 2 direct resource grants must add that projection and repair scope before
enforcement.

## Mapping from the current system

| Application concept                                                  | Schema element                                                                           |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `Membership.role` (`owner`/`manager`/`member`/`billing`)             | `organization` relations `owner`/`manager`/`member`/`billing`                            |
| `TeamUser.role` (`admin`/`contributor`)                              | `team` relations `admin`/`contributor`                                                   |
| `WorkspaceTeam.permission` (`read`/`readWrite`/`manage`)             | `workspace` relations `reader_team`/`writer_team`/`manager_team` (subject `team#member`) |
| `ApiKeyWorkspace.permission` (`read`/`write`/`manage`)               | `workspace` relations `reader`/`writer`/`manager` (subject `api_key`)                    |
| `ApiKey.organizationAccess.accessControl` (`read`/`write`)           | `organization` relations `api_key_reader`/`api_key_writer`                               |
| `Survey.workspaceId` / `Dashboard.workspaceId` / `Response.surveyId` | `survey`/`dashboard` relation `workspace`; `response` relation `survey`                  |

Resource permissions preserve the operation-specific gates that exist today:

| Current application operation                                    | Schema permission                           | Required access                                         |
| ---------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| Read organization teams and workspace-team assignments           | `organization.read_access`, `team.read`     | organization membership or `accessControl.read`/`write` |
| Rename teams or manage team membership                           | `organization.manage_access`, `team.manage` | team admin or `accessControl.write`                     |
| Delete a team                                                    | `team.delete`                               | owner/manager or `accessControl.write`                  |
| Read or edit a survey                                            | `survey.read`, `survey.write`               | workspace `read` or `readWrite`                         |
| Delete a survey through the web application or V3 API            | `survey.delete`                             | workspace `readWrite`                                   |
| Manage survey languages or delete through legacy management APIs | `survey.manage`                             | workspace `manage`                                      |
| Read or mutate a dashboard, including deletion                   | `dashboard.read`, `dashboard.write`         | workspace `read` or `readWrite`                         |
| Read/export a response                                           | `response.read`, `response.export`          | workspace `read`                                        |
| Update, tag, or delete a response through the web application    | `response.write`                            | workspace `readWrite`                                   |
| Delete a response through legacy management APIs                 | `response.manage`                           | workspace `manage`                                      |

Behavioral sources of truth in the application (referenced from the schema's
doc comments):

- `apps/web/lib/authorization` — the engine-independent current-model
  authorization contract and role/grant mapping.
- `apps/web/lib/utils/action-client/action-client-middleware.ts` —
  `checkAuthorizationUpdated`: org-role OR team-permission, weighted
  `read < readWrite < manage`.
- `apps/web/lib/organization/auth.ts` — `verifyUserRoleAccess`: managers manage
  members/billing/API keys but cannot update or delete the organization.
- `apps/web/lib/workspace/auth.ts` — `hasUserWorkspaceAccessForAction`: the
  billing role is excluded from all product data.
- `apps/web/modules/ee/teams/lib/roles.ts` — a member without a team has no
  workspace access; the highest team permission wins.
- `apps/web/modules/organization/settings/api-keys/lib/utils.ts` — API key
  method map (GET→read, POST/PUT/PATCH→write, DELETE→manage) and
  organization `accessControl` checks.

## Semantics guaranteed by the assertions

1. **Owner and manager broad access** — org owners and managers have full
   access to every workspace and its content; only owners may update or delete
   the organization itself.
2. **Billing role blocked from product data** — billing reaches billing
   surfaces only; never workspaces, surveys, responses, or dashboards.
3. **Team-based workspace access** — teams are the only path from a plain
   member to a workspace; a member without a team has no product access.
4. **Externally scoped read-only access** — a read-level team confines an
   external (agency) user to viewing a single workspace. (Per-survey scoping
   does not exist today and is deliberately not modeled.)
5. **Dashboard read derives from workspace read** — dashboards carry no ACL of
   their own. Response export currently equals response read; the separate
   `response_export` permission keeps the vocabulary ready for a future split,
   which would be an asserted schema change.
6. **API key as scoped principal** — workspace-scoped keys act only inside
   their granted workspace at their granted level; organization-level
   `accessControl` rights grant access to organization access-control resources
   but no product data.

## Backfill and repair

Mutation hooks only project records that change while they are running. They do
not cover records that predate them, and they cannot see a row deleted outside a
hook — a projector derives its targets from PostgreSQL, so a relationship whose
source row is already gone is never named and never removed. `pnpm
authzed:backfill` closes both gaps.

```bash
# Report drift over every organization. Writes nothing.
pnpm authzed:backfill

# Converge one organization from PostgreSQL, or a single workspace's grants.
pnpm authzed:backfill --apply --organization-id=<cuid>
pnpm authzed:backfill --apply --workspace-id=<cuid>

# Converge everything, then remove relationships PostgreSQL no longer holds.
pnpm authzed:backfill --apply --prune --confirm-prune --scope=all \
  --expected-endpoint=<host:port>

# Resume an interrupted run from the lastOrganizationId it reported.
pnpm authzed:backfill --apply --after-organization-id=<cuid>
```

Exit codes match `authzed:schema`: `0` reconciled, `2` drift remains, `1` failed
or misused. The result is one line of JSON carrying counters, the offending
record identifiers, the revision the last observation was taken at, and a
`truncated` flag.

Drift is reported in both directions:

- `missing` — records PostgreSQL holds that SpiceDB has no relationship for. This
  is what an empty or stale SpiceDB looks like, so a report that could not see it
  would be worthless. Note this compares *records*, not relations: a membership
  stored as `owner` in PostgreSQL but `member` in SpiceDB counts as present.
  Applying converges the relation regardless, by writing the current value.
- `orphaned` — relationships whose source record is gone.
- `mismatchedParents` — a resource attached to an organization PostgreSQL says
  does not own it. **Reported and never touched.** `organization` is a relation,
  so an extra parent edge is additive and hands every owner and manager of the
  named organization access to another tenant's resource; but removing it safely
  means deleting a relation the resource legitimately needs one of, so it is left
  for a human. Any non-zero count here is a privilege-escalation finding, not
  routine drift.

A dry run over the whole deployment checks both directions per organization,
which costs a read per resource. An applying run skips the `missing` check —
its writes converge that direction anyway — and detects orphans with a single
streamed pass per resource type.

The organization is the unit of work, so a partial run leaves complete graphs for
the organizations it finished rather than a fragment of every tenant's. Runs are
idempotent — relationships are written with `TOUCH` — so re-running is always safe
and is the intended response to a failed unit.

**"No prune" does not mean "no deletes."** Converging a membership inherently
deletes the roles it does not hold. What `--prune` adds is permission to reconcile
records observed *only* in SpiceDB. Even then no delete is precomputed: an
unsourced record becomes a reconciler *target*, and the reconciler re-reads
PostgreSQL before deciding, so a row recreated in the meantime is written rather
than deleted.

Guards on the destructive path:

- a dry run is the default, so a mistyped invocation is inert;
- `--prune` additionally requires `--apply`, `--confirm-prune`, an explicit scope,
  and `--expected-endpoint`;
- `--expected-endpoint` must match `AUTHZED_ENDPOINT`. **`AUTHZED_SYSTEM_KEY` is
  not usable for this** — it is a stable namespace and defaults to the same value
  everywhere, so it cannot tell staging from production;
- exceeding the per-run prune cap (default 500, lowerable via `--max-prune`, never
  raisable) prunes *nothing* for that unit. A large orphan count is a symptom —
  wrong endpoint, wrong database, a restore in progress — not a big cleanup job;
- `survey`, `dashboard`, and `response` relationships are classified ignored, and
  anything outside the vocabulary is reported but never touched.

Two limits worth knowing before relying on a run:

- `--organization-id` and `--workspace-id` report
  `orphanScope: "known_resources"`. SpiceDB relationship filters have no notion of
  "belongs to organization X" and Formbricks object IDs carry no organization
  prefix, so a resource whose row is already gone is unreachable from its
  organization. Only the default whole-deployment run sweeps by resource type and
  can claim completeness. (`--scope=all` is a confirmation token for pruning
  everything, not what selects the sweep — the sweep is the default.)
- The whole-deployment sweep assumes a SpiceDB dedicated to this deployment.
  `AUTHZED_SYSTEM_KEY` is not yet used to namespace object IDs, so a
  resource-type sweep cannot tell another installation's relationships from
  orphans.

Note also that the command reads `.env` and ignores `.env.local`, so the instance
it rewrites is not necessarily the one a local dev server talks to. Always pass
`--expected-endpoint` when pruning.

The command is not present in the released container image, matching
`authzed:health` and `authzed:schema`; running it requires a checkout. Packaging it
for self-hosted operators is ENG-1740.

## Deliberately not modeled (stays in application code)

- Managers may only assign the `member` role when inviting/updating members.
- The billing role is rejected on self-hosted instances.
- `USER_MANAGEMENT_MINIMUM_ROLE` environment override.
- The coarse `hasUserWorkspaceAccess` layout check (billing routing concern).
- Organization-only API keys require per-route opt-in
  (`allowOrganizationOnlyApiKey`).
- Audit logs: writing is feature-flagged; there is no in-app read path, so no
  `read_audit_log` permission exists yet.
