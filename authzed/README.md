# Formbricks Authorization Schema (AuthZed / SpiceDB)

This directory contains the canonical SpiceDB schema for Formbricks and its
assertion-based validation suite.

- `schema.zed` — the canonical, non-composable authorization schema
  (`use typechecking`).
- `schema-validation.yaml` — relationships, assertions, and expected-relations
  blocks that pin down the schema's semantics.
- `validate.sh` — offline validation runner (local `zed` binary or the pinned
  `authzed/zed` container image; no SpiceDB server needed).
- [Direct AuthZed cutover and rollback contract](https://linear.app/formbricks/document/direct-authzed-cutover-and-rollback-contract-b4c352aecdad) — the approved direct-authority, fail-closed,
  immutable-artifact, rollback, and environment-gate contract. It supersedes
  the earlier shadow/cohort release proposal and remains in Linear rather than
  being duplicated in this repository.
- [`RUNBOOK.md`](./RUNBOOK.md) — diagnosing and recovering from relationship-sync
  failures: the metrics, the log field contract, suggested alert rules, and the
  recovery path through `pnpm authzed:backfill`.
- [`PERFORMANCE.md`](./PERFORMANCE.md) — measured cost of a single authorization
  decision (legacy vs SpiceDB), the proof that the workspace-scoped list paths issue
  a row-count-independent number of checks, and how to reproduce both with
  `pnpm authzed:perf`.
- [`AuthZed Operations`](../docs/self-hosting/advanced/authzed-operations.mdx) —
  the public self-hosting contract for Docker and Kubernetes operators.

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

The current authorization contract treats every `Membership` row as active without checking
`Membership.accepted`. The projection deliberately preserves that
behavior: accepted and pending membership rows project identically. An
`Invite` alone is not projected.

Every authorization-bearing source table has a PostgreSQL trigger that inserts a
projection event in the same transaction as the source mutation. The existing
post-commit projector remains as a low-latency fast path, but the PostgreSQL
outbox is the durable delivery contract: BullMQ wakes a worker every five
seconds, the worker claims rows with leases and `FOR UPDATE SKIP LOCKED`, and the
idempotent reconcilers deliver each claimed batch as six independent groups.

Failure is attributed rather than shared. A group that fails takes only its own
events; the rest of the batch is still delivered. A retryable failure releases
every remaining group untried, because spending another three-attempt budget per
group against an unreachable instance buys nothing.

Dead-lettering requires the failure to _name_ an event, which takes three things
together: the code is non-retryable, the attempt covered exactly one event, and
the code is one an event can actually cause
(`authzed_projection_invalid_source`, `authzed_invalid_request`). The third
condition is not redundant. On a five-second cadence most groups hold a single
event, so size alone would charge whichever revocations happened to be
travelling alone when SpiceDB rejected a credential — dead-lettering bystanders
mid-outage, which is the opposite of the intent. Those same event-attributable
codes are the ones that trigger halving the group until the culprit is alone;
codes describing the instance are neither split nor charged. Ten solitary,
attributable failures dead-letter the event.

The consequence is the property worth remembering: **no SpiceDB outage, of any
duration or kind, can dead-letter an event that was never the problem.**

AuthZed being disabled performs no delivery work. An AuthZed outage never
changes a successful PostgreSQL mutation into an application error; committed
outbox rows remain recoverable and are replayed when SpiceDB returns. Existing
records and independent drift are reconciled by the six-hour applying audit and
by `pnpm authzed:backfill` (see [Backfill and repair](#backfill-and-repair)). A
clean graph and drained outbox are mandatory before direct authority.

Deletes, and updates that are not provably grants, are classified as revocations.
The classifier is deny-by-default: an unmapped target type, an unmapped column,
or any enum move is a revocation. Only three transitions are treated as grants,
each because the projectors' own write shape proves the relationship set can only
grow — reactivating a user, unarchiving a feedback directory that stays in its
organization, and any membership update that leaves `role` unchanged (the
projected snapshot ignores `accepted`, so accepting an invite writes identical
relationships).

The permission ladder is deliberately not encoded in the trigger. It is rankable,
but a rank table in SQL has no compile-time backstop the way
`relationship-map.ts` does, so a change to `authzed/schema.zed` would silently
make it wrong in the fail-open direction — the one direction this guard must
never be wrong in. Role changes are one-at-a-time admin actions rather than the
bulk operations the classifier exists to keep off the guard. Revisit only if a
bulk re-roling path appears.

This matters because the guard is global and unscoped. Direct authority refuses
protected operations with `authzed_projection_stale` when an unresolved
revocation reaches 60 seconds or enters dead letter, so an undelivered event
classified as a revocation denies every enforced check in the deployment. A mass
invite acceptance or reactivation sweep must therefore not arm it.

If a source pair moves, the trigger enqueues both the previous pair as a
revocation and the current pair, preventing a stale old edge from becoming
undiscoverable.

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
cannot see. API-key principals are routed through the central interface; the
direct-authority release contract is now owned by ENG-2448 and
the [direct AuthZed cutover and rollback contract](https://linear.app/formbricks/document/direct-authzed-cutover-and-rollback-contract-b4c352aecdad).

## Feedback Dataset projection

The product term **Feedback Dataset** maps to Prisma `FeedbackDirectory`. PostgreSQL remains the source
of truth for each directory, its owning organization, archive state, and its
`FeedbackDirectoryWorkspace` assignments.

- A directory projects `feedback_directory#organization@organization`.
- An active same-organization assignment projects a three-edge subgraph linking the directory, an opaque
  `feedback_directory_assignment`, and the assigned workspace.
- The assignment object ID is a deterministic `fdwa_`-prefixed SHA-256 digest of the length-framed
  directory/workspace pair. Source IDs and the generated ID never appear in projection logs.
- Archived assignments are not active grants. Reconciliation removes all three stored edges.
- A directory and workspace belonging to different organizations is invalid source state. It is reported
  for manual investigation and never projected.

Directory administrators inherit from `organization.manage`. Team members and API keys inherit through
the exact assigned workspace. The assignment resource ensures that an operation scoped to workspace A
cannot use access granted through workspace B. Directory-wide checks can union all active assignments for
gateway operations that do not carry workspace context.

Projection runs after the PostgreSQL mutation commits and remains best-effort. Creation, assignment
replacement, archive/restore, workspace deletion, and organization deletion reconcile captured previous
and current pairs. The repair command covers existing rows, missing edges, stale archived edges, parent
drift, and exact three-edge permission drift.

Feedback records, feedback sources, charts, workflows, contacts, attributes, and segments do not receive
standalone Phase 1 SpiceDB resources. Charts and workflows inherit workspace authorization. Chart
`createdBy` is metadata rather than authorization ownership, and record-level tenant/integrity checks
remain in the application and Hub layers.

### Feedback Dataset authorization routing

Current feedback access is routed through the central Formbricks authorization interface without changing
its effective rules:

- dataset administration checks `organization.manage`;
- workspace-scoped records, taxonomy, sources, CSV imports, chart queries, and server-rendered Unify
  entry points check the exact `feedbackDirectoryAssignment` resource;
- directory-wide gateway reads and creates check `feedbackDirectory.read` or
  `feedbackDirectory.write` across all active assignments;
- existing-record mutations still require organization management for users and an exclusively assigned
  dataset plus the existing workspace permission for API keys;
- archive, entitlement, OAuth-scope, Hub tenant, source ownership, and record-integrity checks remain in
  the application layer and execute in their existing order.

Authenticated feedback-gateway requests carry the bounded `feedback_gateway` telemetry surface. Public and
unauthenticated gateway traffic is never authorized as an authenticated actor. The surface only attributes
authoritative metrics; it does not select an evaluator.

## Resource parent resolution during the current-model migration

The initial migration deliberately does not project one relationship for every
survey, dashboard, and response. ENG-1738's private evaluator uses
the existing server-only PostgreSQL resolvers to map:

- a survey or dashboard to its workspace;
- a response to its survey, then to its workspace.

It then checks the equivalent workspace permission in SpiceDB. This preserves
the current authorization boundary and avoids adding a high-cardinality
`response#survey` projection to every response mutation before direct authority.
Resolver database failures remain operational errors and missing resources
remain denials, preserving the current authorization contract.

The `survey#workspace`, `dashboard#workspace`, and `response#survey` relations
remain in the schema for later resource-level sharing. They must not be queried
directly until a future projector and matching backfill scope cover those edges;
the backfill classifies them as ignored today and never prunes them.
Phase 2 direct resource grants must add that projection and repair scope before
enforcement.

## Authorization evaluation and direct cutover

The private SpiceDB evaluator sits behind the existing server-only `can()` and
`assertCan()` contract. The direct-authority image makes SpiceDB the sole evaluator
with no runtime legacy fallback or cohort selector. The separately pinned bridge
image remains the deployment rollback artifact while the durable outbox keeps its
relationship graph current.

The immutable bridge/candidate artifacts, fail-closed behavior, sandbox-first
sequence, staging and regional production gates, abort triggers, rollback, and
self-hosted v6 contract are defined in the [direct AuthZed cutover and rollback
contract](https://linear.app/formbricks/document/direct-authzed-cutover-and-rollback-contract-b4c352aecdad). Operational execution is documented in the
[relationship sync runbook](./RUNBOOK.md#7-direct-authority-cutover).

## Mapping from the current system

| Application concept                                                  | Schema element                                                                           |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `Membership.role` (`owner`/`manager`/`member`/`billing`)             | `organization` relations `owner`/`manager`/`member`/`billing`                            |
| `TeamUser.role` (`admin`/`contributor`)                              | `team` relations `admin`/`contributor`                                                   |
| `WorkspaceTeam.permission` (`read`/`readWrite`/`manage`)             | `workspace` relations `reader_team`/`writer_team`/`manager_team` (subject `team#member`) |
| `ApiKeyWorkspace.permission` (`read`/`write`/`manage`)               | `workspace` relations `reader`/`writer`/`manager` (subject `api_key`)                    |
| `ApiKey.organizationAccess.accessControl` (`read`/`write`)           | `organization` relations `api_key_reader`/`api_key_writer`                               |
| `FeedbackDirectory.organizationId`                                   | `feedback_directory#organization@organization`                                           |
| Active `FeedbackDirectoryWorkspace`                                  | Three-edge `feedback_directory_assignment` graph to the exact workspace                  |
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
- `apps/web/lib/authorization/permission-action.ts` — exhaustive translation of
  HTTP/team permission ladders into semantic actions.
- `apps/web/lib/organization/auth.ts` — `verifyUserRoleAccess`: managers manage
  members/billing/API keys but cannot update or delete the organization.
- `apps/web/lib/workspace/auth.ts` — navigation and integration-specific compositions;
  the billing role is excluded from product data.
- `apps/web/modules/ee/teams/lib/roles.ts` — a member without a team has no
  workspace access; the highest team permission wins.
- `apps/web/lib/authorization/spicedb-evaluator.ts` — tenant-safe scope resolution,
  API-key ownership checks, and authoritative permission evaluation.

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

# Remove the relationships of a workspace whose row is gone. This is a prune —
# every relationship on that workspace goes, team and API-key grants included —
# so it takes the prune flags rather than --apply alone.
pnpm authzed:backfill --apply --prune --confirm-prune --workspace-id=<cuid> \
  --expected-endpoint=<host:port>

# A stale grant whose *team or API key* is also gone is reported but not removed by
# this scope: deleting it would delete that principal's relationships everywhere,
# which is the organization or full sweep's unit of work, not one workspace's.

# Converge everything, then remove relationships PostgreSQL no longer holds.
pnpm authzed:backfill --apply --prune --confirm-prune --scope=all \
  --expected-endpoint=<host:port>

# Resume an interrupted run from the lastOrganizationId it reported.
pnpm authzed:backfill --apply --after-organization-id=<cuid>
```

Exit codes match `authzed:schema`: `0` reconciled, `2` drift remains, `1` failed
or misused. **`0` means every category is clear, including the ones this tool
deliberately will not repair** — `invalid` and `unmanaged` count toward drift
exactly like `orphaned` and `missing`, because unrepaired authorization state is
still authorization state and this exit code is what gates direct authority. The
result is one line of JSON carrying counters, the offending record identifiers,
a revision captured _after_ the run's own writes (`null` for a dry run), and a
`truncated` flag. The revision remains useful operational evidence, but the
approved direct-authority release uses `fully_consistent` reads and does not use
it as a shadow freshness floor.

That JSON is the whole diagnostic: like the other AuthZed commands, this one runs
at `LOG_LEVEL=fatal` so stdout stays a single parseable line. Each entry in
`failures` therefore carries `attempts` alongside the sanitized code, because
"failed once" and "exhausted the retry budget" call for different reactions and
the logs that would otherwise distinguish them are suppressed.

Drift is reported in both directions:

- `missing` — records PostgreSQL holds that SpiceDB has no relationship for. This
  is what an empty or stale SpiceDB looks like, so a report that could not see it
  would be worthless.
- `mismatchedPermissions` — an existing source record whose exact role, grant, or
  independent access-flag relationship set differs from PostgreSQL. This catches
  stale privilege upgrades such as a `manager_team` relationship for a source row
  that now grants only `read`. Applying reconciliation writes the current value;
  a follow-up dry run confirms the mismatch is gone.
- `orphaned` — relationships whose source record is gone.
- `invalid` — source rows whose principal and resource belong to different
  organizations. Never projected and never pruned, in either scope.
- `unmanaged` — relationships outside the vocabulary. Reported, never touched.
- `mismatchedParents` — a resource attached to an organization PostgreSQL says
  does not own it. **Reported and never touched.** `organization` is a relation,
  so an extra parent edge is additive and hands every owner and manager of the
  named organization access to another tenant's resource; but removing it safely
  means deleting a relation the resource legitimately needs one of, so it is left
  for a human. Any non-zero count here is a privilege-escalation finding, not
  routine drift.

  **Only `--scope=all` can find one.** The escalation is an edge on _another_
  tenant's resource that names the organization under investigation, and a
  single-organization run reads only the resources PostgreSQL says that
  organization owns — so the offending resource is never read. A
  `--organization-id` run reporting `mismatchedParents: 0` therefore means "none
  among this tenant's own resources", not "this tenant is not being targeted".

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
records observed _only_ in SpiceDB. Even then no delete is precomputed: an
unsourced record becomes a reconciler _target_, and the reconciler re-reads
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
  raisable) prunes _nothing_ — not a capped subset. Every unit, the streamed sweep
  included, counts its orphans to completion before deleting any of them, so the
  cap aborts before the first delete rather than part-way through. A large orphan
  count is a symptom — wrong endpoint, wrong database, a restore in progress — not
  a big cleanup job;
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

Released Formbricks images include the equivalent `formbricks-authzed backfill`
command for self-hosted operators. Repository development retains
`pnpm authzed:backfill`.

## Durable projection outbox

Release images expose bounded, identifier-free outbox operations:

```bash
formbricks-authzed outbox status
formbricks-authzed outbox drain
formbricks-authzed outbox drain --max-batches=500
formbricks-authzed outbox replay
```

`status` reports aggregate pending, dead-letter, oldest-age, and revocation-age
counts. `drain` claims revocations first and stops after the requested number of
batches or the first batch that delivers nothing at all — a partially delivered
batch is the normal outcome once failures are attributed per group, so draining
stops on no progress rather than on any failure. `replay` resets all unresolved
dead letters to attempt zero and returns their full permanent-failure budget; it
does not bypass normal reconciliation, retry, or freshness checks. These commands
never print target IDs, relationships, credentials, or raw errors.

Dead letters also clear themselves. A dead-lettered revocation has no age bound
in the freshness guard on purpose — an old one is more dangerous than a fresh one
— so the six-hour audit replays every unresolved dead letter whenever it comes
back `reconciled`, bounding a global denial at six hours rather than at whenever
an operator notices. A still-poisoned event simply dead-letters again.

The recurring six-hour audit runs the normal full-deployment applying backfill
without prune. It can repair attributable missing and mismatched-permission
edges, but it never automatically deletes orphaned or unmanaged relationships or
changes a mismatched parent. Those categories still require the guarded operator
workflow above. Successfully delivered outbox rows are retained for seven days;
the scheduled audit removes at most 10,000 expired rows per run. Pending and
dead-letter rows are never removed by retention cleanup.

## Self-hosted v6 upgrade gate

Release images expose two aggregate-only orchestration commands:

```bash
formbricks-authzed upgrade prepare
formbricks-authzed upgrade check
```

`prepare` requires `AUTHZED_ENABLED=true` and `AUTHZED_CONSISTENCY=fully_consistent`, checks authenticated
datastore health, applies an empty or guarded canonical schema, drains the outbox, runs attributable repair, and
audits the final graph. `check` repeats the health, schema, outbox, and full dry-run audit without writing. It
exits 0 only for a direct-authority-ready deployment, 2 when readiness is blocked by drift, and 1 for a failed
configuration or operation. Unlike the detailed backfill report, both commands emit aggregate counters only.

## Deliberately not modeled (stays in application code)

- Managers may only assign the `member` role when inviting/updating members.
- The billing role is rejected on self-hosted instances.
- `USER_MANAGEMENT_MINIMUM_ROLE` environment override.
- The coarse `hasUserWorkspaceAccess` layout check (billing routing concern).
- Organization-only API keys require per-route opt-in
  (`allowOrganizationOnlyApiKey`).
- Audit logs: writing is feature-flagged; there is no in-app read path, so no
  `read_audit_log` permission exists yet.
