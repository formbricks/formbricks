# AuthZed relationship sync runbook

PostgreSQL is the source of truth for authorization facts. SpiceDB holds their relationship projection and
becomes the sole decision engine in the direct-authority artifact.

The durable bridge inserts a PostgreSQL outbox row in the same transaction as every authorization-bearing
source mutation. Existing post-commit projection remains a low-latency fast path, while the outbox is the
recoverable delivery contract. BullMQ only wakes the worker; queue state and leases remain in PostgreSQL.

> **Direct authority requires durable delivery.** A committed authorization mutation must enqueue its
> relationship reconciliation atomically, and a revocation that cannot be delivered within 60 seconds must make
> protected authorization fail closed.

Everything below exists to make that visible and recoverable.

See also: [direct cutover contract](./CUTOVER.md) for the approved release and rollback contract,
[README](./README.md) for the projection development contract, and
[AuthZed Operations](../docs/self-hosting/advanced/authzed-operations.mdx) for the public self-hosted operator
contract.

## 1. Symptoms

| What you see                           | What it usually means                           |
| -------------------------------------- | ----------------------------------------------- |
| Outbox warning count is non-zero       | A revocation has been pending for 15 seconds.   |
| Outbox critical count is non-zero      | A revocation has been pending for 45 seconds.   |
| `authzed_projection_stale`             | Revocation is 60 seconds old or dead-lettered.  |
| Scheduled reconciliation reports drift | Attributable graph drift was found or repaired. |
| A dead letter is present               | Delivery exhausted 20 attempts; investigate.    |

On the bridge artifact, legacy authorization is unaffected while durable delivery retries or repair converges
the graph. On the direct-authority artifact, operational AuthZed failures fail protected operations closed.

## 2. Diagnosis

### Is AuthZed reachable and correctly configured?

```bash
pnpm authzed:health     # 0 healthy, 1 otherwise
pnpm authzed:schema check   # 0 matched, 2 drifted, 1 failed
formbricks-authzed outbox status  # 0 healthy, 2 warning/critical, 1 failed
```

Note `status: "disabled"` from the health command exits **1**. A deployment that believes AuthZed is on
while `AUTHZED_ENABLED` is off looks healthy by every other signal, which is why the projection metric
records `disabled` as its own outcome rather than skipping.

### Metrics

All metrics carry only bounded attributes — never an organization, user, or relationship identifier.

| Metric                                                            | Attributes                          | Read it as                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `formbricks_authzed_projection_total`                             | `operation`, `projection`, `status` | Projection outcomes. `status` is `projected` / `failed` / `disabled`.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `formbricks_authzed_projection_duration_seconds`                  | same                                | Projection latency. It sits on the request path, so a rise here is user-visible. `disabled` outcomes are deliberately excluded — their duration is a structural zero, not a measurement.                                                                                                                                                                                                                                                                                                                                         |
| `formbricks_authzed_request_failures_total`                       | `operation`, `code`, `retryable`    | Requests that exhausted their retry budget — _any_ facade call, including schema operations and reads, and one failed write can carry a whole batch. So a sample is one terminal request failure, **not** one dropped relationship. For "did projection drift get introduced?", use `formbricks_authzed_projection_total{status="failed"}`.                                                                                                                                                                                      |
| `formbricks_authzed_request_retries_total`                        | `operation`, `code`                 | Retries scheduled. Elevated but not failing = degraded, not down.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `formbricks_authzed_authorization_checks_per_request`             | `surface`                           | How many central authorization operations one request made. Scalar `can()`/`assertCan()` calls and narrow list observations each count once. Watch the upper percentiles for a page regressing into one operation per row; a rising p99 on a list surface is the N+1 signal. Buckets start at 0.5 so "made no decisions" stays distinct from "made exactly one" — most healthy requests sit in the second bucket. No threshold is suggested yet: it needs a production baseline first. See [`PERFORMANCE.md`](./PERFORMANCE.md). |
| `formbricks_authzed_projection_outbox_delivery_total`             | `status`                            | Durable outbox events delivered or failed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `formbricks_authzed_projection_outbox_delivery_duration_seconds`  | `status`                            | Duration of one claimed delivery batch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `formbricks_authzed_projection_outbox_status`                     | `state`                             | Current pending, dead-letter, 15-second warning, and 45-second critical counts.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `formbricks_authzed_projection_outbox_oldest_pending_age_seconds` | none                                | Current age of the oldest pending event.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `formbricks_authzed_reconciliation_audit_total`                   | `status`                            | Six-hour applying audit outcomes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `formbricks_authzed_reconciliation_drift_total`                   | `kind`                              | Attributable drift and operational failures observed by scheduled audits.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Exported through the readers already configured in `instrumentation-node.ts`: Prometheus when
`PROMETHEUS_ENABLED=1` (scraped by the chart's ServiceMonitor), OTLP when
`OTEL_EXPORTER_OTLP_ENDPOINT` is set.

**The backfill command deliberately exports nothing.** It is a short-lived process with no scrape
window; its observability is the counters in its own JSON result and its exit code.

### Logs

Every AuthZed log line carries `component: "authzed"`. Failure lines share a stable field set, so one
query covers all of them:

| Field          | Present on                | Meaning                                                                                                 |
| -------------- | ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `component`    | everything                | Always `"authzed"`.                                                                                     |
| `operation`    | everything                | The facade operation or projection entry point.                                                         |
| `status`       | projection outcomes       | `projected` / `failed`.                                                                                 |
| `errorCode`    | every failure             | Sanitized `authzed_*` code. Never a raw error.                                                          |
| `retryable`    | every failure             | Whether a retry could have helped.                                                                      |
| `durationMs`   | requests and projections  | —                                                                                                       |
| `projection`   | projection outcomes       | Which projector: `organization_membership`, `team_workspace`, `api_key`.                                |
| `attempts`     | projection failures       | Total attempts behind the failure.                                                                      |
| `attemptCount` | request failures/retries  | Which attempt this line is about. Distinct from `attempts` above — request layer, not projection layer. |
| `grpcStatus`   | request failures/retries  | Numeric gRPC status.                                                                                    |
| `errorName`    | post-commit boundary only | Error _class_ name when a projector itself threw.                                                       |

```
# Projections that failed — the drift signal. `status` is on projection outcomes only, which is what
# this wants: a request-layer failure inside a projection surfaces here too.
component:"authzed" AND status:"failed"

# Any AuthZed failure of one kind, at either layer.
component:"authzed" AND errorCode:"authzed_unavailable"
```

**Identifiers never appear in logs.** No organization, user, team, workspace, or API-key ID; no schema
text; no tokens. If you need to know _which_ records drifted, that comes from the backfill's stdout
(see §3), not from logs.

### Correlating with SpiceDB itself

A projection-failure spike with healthy SpiceDB metrics points at the app side; both unhealthy points
at the datastore. Worth checking on the SpiceDB side:

- **`pgxpool_empty_acquire`** — datastore connection starvation, the usual cause of
  `authzed_unavailable` / `authzed_overloaded` bursts under load. AuthZed's guidance is to divide the
  datastore's max connections by pod count, then split between read and write pools.
- SpiceDB dispatch and cache metrics from the operator's ServiceMonitor.
- `spicedb` pod restarts, and whether `spicedb datastore migrate` ran on the last upgrade.

## 3. Recovery

Escalate in this order. Every step is safe to repeat — relationships are written with `TOUCH`.

**1. See what is wrong. Writes nothing.**

```bash
pnpm authzed:backfill
```

Exit `0` clean, `2` drift remains, `1` failed. Read `counters`, `orphans`, and `failures` from the JSON.

`0` covers **every** unrepaired category, not only the ones the tool fixes: `invalid` (source rows whose
principal and resource sit in different organizations) and `unmanaged` (relationships outside the
vocabulary) count toward drift alongside `orphaned`, `missing` and `mismatchedParents`. That matters
because this exit code is the gate for direct authority below — a run cannot report
clean while authorization state nothing accounts for is still present.

**A non-zero `invalid` needs a human.** These are cross-organization source rows in PostgreSQL: the join
tables carry independent foreign keys and no same-organization constraint, so the row is representable
even though nothing in Formbricks creates one. The backfill will never project or prune them. Establish
how the row was written, then correct or delete it in PostgreSQL — after which a re-run reports clean.

**2. Converge what PostgreSQL says should exist.**

```bash
pnpm authzed:backfill --apply
```

This fixes dropped and wrong relationships. It does **not** remove relationships whose source row is
gone — expect `status: "drifted"` and a non-zero `orphaned` if any exist.

**3. Remove what PostgreSQL no longer holds.**

```bash
pnpm authzed:backfill --apply --prune --confirm-prune --scope=all \
  --expected-endpoint=<host:port>
```

Before running this, read §4.

**Scope it down when you can.** If the drift is one tenant, `--organization-id=<cuid>` is the smaller
blast radius. It reports `orphanScope: "known_resources"` because a resource whose row is already gone
is unreachable from its organization; only `--scope=all` can claim completeness.

**One workspace.** `--workspace-id=<cuid>` is narrower still, and unlike an organization the workspace
does not have to exist — a workspace whose row is gone is the case most worth repairing:

```bash
# Converge one workspace's team and API-key grants.
pnpm authzed:backfill --apply --workspace-id=<cuid>

# Remove the relationships of a workspace whose row is gone. This is a prune — every relationship on
# that workspace goes, team and API-key grants included — so it takes the prune flags, not --apply
# alone. Without them the run reports the orphans and removes nothing.
pnpm authzed:backfill --apply --prune --confirm-prune --workspace-id=<cuid> \
  --expected-endpoint=<host:port>
```

Narrow, but not hermetic: the API keys holding grants on that workspace are reconciled in full, which
also converges their grants on _other_ workspaces. That direction only ever writes what PostgreSQL says,
so it is a wider repair than you asked for.

**Deletion is held to the workspace, but at a cost worth knowing.** A grant ref implies its principal, and
a principal with no PostgreSQL row makes the reconciler delete subject-wide — every workspace
relationship for that team, or every organization _and_ workspace relationship for that key. One orphan
here would then delete relationships in other tenants, none of it weighed against this run's cap. So this
scope **withholds** any grant whose team or API key is also gone: it stays counted in `orphaned`, nothing
is deleted for it, and the run finishes `drifted`. That cleanup belongs to `--organization-id` or
`--scope=all`, where the wider deletion is the intended unit of work. If a workspace run keeps reporting
orphans it will not prune, this is why — widen the scope.

**Resuming.** A run reports `lastOrganizationId`. Feed it back:

```bash
pnpm authzed:backfill --apply --after-organization-id=<cuid>
```

**Per-unit failures.** One organization failing does not abort the sweep; it lands in `failures` with a
code, and the run exits `1`. Re-running is the fix — successful units simply re-converge.

**`truncated: true`** means the counters are not exact, from one of two causes that err in opposite
directions. Either an observation was abandoned mid-read, so fewer relationships were seen than exist
and the counts are a floor — or the sweep's deduplication bound was exceeded, so records implied by
more than one page beyond that point are counted twice and the counts may over-report. The second only
happens at a scale orders of magnitude past the prune cap, so nothing is deleted on the strength of it.
Either way, re-run before concluding anything.

### Reading the drift counters

- **`missing`** — records PostgreSQL holds that SpiceDB has no relationship for. What an empty or stale
  SpiceDB looks like. Step 2 fixes it.
- **`mismatchedPermissions`** — an existing source record has the wrong exact role, grant, or independent
  access-flag relationship set. Treat a stale higher permission as a security finding. Step 2 converges
  it; require a follow-up dry run with this counter at zero.
- **`orphaned`** — relationships whose source record is gone. Only step 3 removes them.
- **`mismatchedParents`** — **treat as a security finding, not routine drift.** A resource is attached to
  an organization PostgreSQL says does not own it. `organization` is a relation, so the edge is _additive_:
  every owner and manager of the named organization has access to that resource through
  `organization->manage`, and no PostgreSQL row explains it. The backfill reports these and deliberately
  never removes them, because deleting a parent edge means deleting a relation the resource legitimately
  needs one of. Confirm the true owner in PostgreSQL, then remove the wrong edge by hand.

  **Read the reported `relation` first — it decides which command applies**, because two relationship
  shapes state ownership and the organization sits on opposite sides of them:

  ```bash
  # relation == "organization": the child's own parent edge.
  zed relationship delete <childType>:<childId> organization organization:<wrongOrganizationId>

  # any other relation (an organization-level API-key access grant, e.g. api_key_reader/api_key_writer):
  # resource and subject are reversed.
  zed relationship delete organization:<wrongOrganizationId> <relation> <childType>:<childId>
  ```

  Running the first command against the second case deletes nothing and leaves the grant — still handing
  `manage_access` over another tenant's organization — so check the field rather than assuming.

  Then re-run step 2 to confirm the correct edge is present, and work out how it was written — nothing in
  Formbricks creates one.

  **Only `--scope=all` can find one.** The escalation is an edge on _another_ tenant's resource naming
  the organization you are investigating, and a `--organization-id` run reads only the resources
  PostgreSQL says that organization owns — so it never reads the offending resource. A single-tenant run
  reporting `mismatchedParents: 0` means "none among this tenant's own resources", **not** "this tenant
  is not being targeted". Investigating a suspected escalation means a full sweep.

## 4. Before you prune

`--prune` is the only destructive mode, and the guards are deliberately inconvenient.

**Confirm which instance you are about to rewrite.** `--expected-endpoint` must match
`AUTHZED_ENDPOINT`. This is the guard against a stale `.env`, and it matters more than it looks:

> **These commands load `.env` and ignore `.env.local`.** Next.js prefers `.env.local`, so the instance
> the CLI rewrites is not necessarily the one your dev server talks to.

`AUTHZED_SYSTEM_KEY` is **not** usable for this. It is documented as a stable namespace and defaults to
`formbricks` everywhere, so it cannot tell staging from production.

**"No prune" does not mean "no deletes."** Converging a membership inherently deletes the roles it does
not hold. What `--prune` adds is permission to reconcile records observed _only_ in SpiceDB.

**A large orphan count is a symptom, not a workload.** Exceeding the per-run cap (500, lowerable with
`--max-prune`, never raisable) prunes _nothing_ — not a capped subset — and reports it. Every unit,
the streamed whole-deployment sweep included, counts its orphans to completion before deleting any of
them, so the cap aborts before the first delete rather than part-way through. Before raising your
expectations, check: right endpoint? right database? a restore in progress? `--scope=all` on a SpiceDB
shared with another installation?

**Preconditions for `--scope=all`:**

- a SpiceDB dedicated to this deployment — `AUTHZED_SYSTEM_KEY` does not yet namespace object IDs, so a
  resource-type sweep cannot tell another installation's relationships from orphans;
- the sweep must finish inside `--datastore-gc-window` (24 h default on the Postgres datastore); a run
  that outlives it reports `truncated`.

## 5. When AuthZed is unavailable

### Projection bridge before the durable outbox

PostgreSQL stays authoritative and product authorization is unaffected, but every projection attempted during
the outage may be lost. Expect `authzed_unavailable` in logs and a rising failure counter. This bridge is not
eligible for direct authority.

What matters is afterwards:

1. Assume every projection attempted during the outage was dropped and will not be retried.
2. Once SpiceDB is healthy, `pnpm authzed:health` returns `healthy`.
3. Run the backfill (§3). Until it reports a clean run, assume the graph is incomplete.
4. Keep every direct-authority deployment blocked until the run is clean.

To stop projecting entirely on this temporary bridge, set `AUTHZED_ENABLED=0`. Projections become no-ops and no
client is constructed; product authorization is untouched because it still runs on the legacy evaluator. Drift
accumulates for the whole period, so a full backfill is required before re-enabling.

### Durable bridge and direct authority

Source mutations commit a PostgreSQL outbox item atomically. SpiceDB outage does not roll back a
successful business mutation; delivery retries from PostgreSQL and BullMQ is only the recurring trigger. When
the service recovers:

1. Run `formbricks-authzed health` and verify datastore migrations.
2. Inspect `formbricks-authzed outbox status` and correct the operational cause.
3. Run `formbricks-authzed outbox replay` when dead letters are understood, then
   `formbricks-authzed outbox drain`.
4. Run the complete dry-run audit, apply attributable repair, and require two consecutive clean audits.
5. Keep direct-authority cutover blocked while a revocation is pending, dead-lettered, or older than its SLA.

In the direct-authority artifact, a SpiceDB, datastore, resolver, configuration, freshness, or unsupported-result
failure is not an ordinary denial and never falls back. The protected operation receives a sanitized operational
failure and fails closed. Formbricks `/health`, startup, readiness, and liveness remain independent so unrelated
workloads are not restarted.

## 6. Historical comparison controls (not a release strategy)

> **Superseded:** The configuration below documents the migration bridge that was used for parity research. Do
> not configure it for sandbox, staging, production, or self-hosted cutover. The approved release path is the
> direct-authority procedure in §7 and [`CUTOVER.md`](./CUTOVER.md). ENG-2450 removes these controls from the
> candidate image.

Authorization rollout is an internal deployment control. It is intentionally not part of one-click or
public self-hosting configuration. Long-running processes read the cohort once; change the cohort label
and restart the deployment whenever membership changes so a new observation window cannot be confused
with the old one.

The global switch is `AUTHZED_AUTHORIZATION_ENABLED`. With it unset or false, `can()` uses only the
legacy evaluator and does not resolve rollout scope or construct an AuthZed client. A rollout rule is
the Cartesian product of its target list and organization allowlist:

```dotenv
AUTHZED_AUTHORIZATION_ENABLED=true
AUTHZED_AUTHORIZATION_COHORT=sandbox_users_v1

# Shadow one authenticated surface for two organizations.
AUTHZED_SHADOW_TARGETS=server_action:user
AUTHZED_SHADOW_ORGANIZATION_IDS=org_a,org_b

# Freshness floor returned by the latest clean applying backfill.
AUTHZED_CONSISTENCY=minimize_latency
AUTHZED_MINIMUM_SNAPSHOT=<completedAtSnapshot>
```

Valid targets are:

```text
server_action:user
page:user
api_v1:user
api_v1:apiKey
api_v2:apiKey
api_v3:user
api_v3:apiKey
mcp:user
mcp:apiKey
feedback_gateway:user
feedback_gateway:apiKey
```

`page:user` is the server-rendered route surface. It is the one target whose boundary is not a single
request wrapper — see `apps/web/lib/authorization/context.ts` for what it does and does not cover.

This block is asserted against `AUTHZED_AUTHORIZATION_ROLLOUT_TARGETS` by
`apps/web/lib/authzed/rollout-runbook.test.ts`, so a new target cannot ship without appearing here.

Use `*` as the sole organization entry only when every organization in the deployment is intentionally
selected. Empty CSV entries, unknown targets, unsupported surface/actor pairs, or mixing `*` with
explicit IDs are rejected at startup. Target and organization lists must always be supplied together.

In shadow mode the legacy decision is returned immediately and the AuthZed comparison runs after the
response. `minimize_latency` becomes an `at_least_as_fresh` check at `AUTHZED_MINIMUM_SNAPSHOT`; never
invent or reuse a snapshot from an earlier repair window. Mismatches and operational errors are
observable, but neither can alter the response.

Enforcement requires fully-consistent reads:

```dotenv
AUTHZED_AUTHORIZATION_ENABLED=true
AUTHZED_AUTHORIZATION_COHORT=sandbox_users_enforced_v1
AUTHZED_CONSISTENCY=fully_consistent
AUTHZED_ENFORCEMENT_TARGETS=server_action:user
AUTHZED_ENFORCEMENT_ORGANIZATION_IDS=org_a
```

When a request matches both modes, enforcement wins. SpiceDB is authoritative inline and the legacy
decision is compared after the response. A SpiceDB deny remains a normal deny; an AuthZed or
source-resolver outage throws a sanitized operational error and fails closed. Legacy comparison failures
after cutover are recorded but cannot change the SpiceDB-authoritative response.

Comparison telemetry contains only bounded dimensions: cohort, surface, actor type, mode,
actor/resource type, action, decisions, outcome, stable error source, and stable AuthZed code. IDs,
relationship strings, snapshots, tokens, raw SDK errors, requests, and responses are never emitted.

The comparison counter records directional outcomes, not requests. A scalar comparison and a matching
workspace-list observation each emit one sample. A workspace-list observation with drift in both
directions emits two samples: one for each mismatch direction. Therefore, use the checks-per-request
histogram for request amplification and inspect list mismatch directions independently; do not treat the
comparison-counter sample total as a workspace-list request count.

```promql
# Completed comparisons by mode, surface, actor type, cohort, and outcome.
sum by (mode, surface, actor_type, cohort, outcome) (
  rate(formbricks_authzed_authorization_comparisons_total[5m])
)

# MCP workspace-list outcomes for one rollout cohort. Both mismatch series must remain at zero.
sum by (outcome) (
  increase(formbricks_authzed_authorization_comparisons_total{
    surface="mcp",
    action="workspace.read",
    resource_type="workspace",
    cohort="$cohort"
  }[$window])
)

# Mismatch rate. Operational errors are measured separately.
sum(rate(formbricks_authzed_authorization_comparisons_total{outcome=~"legacy_allow_authzed_deny|legacy_deny_authzed_allow"}[5m]))
/
sum(rate(formbricks_authzed_authorization_comparisons_total{outcome!="operational_error"}[5m]))

# Operational-error rate.
sum(rate(formbricks_authzed_authorization_comparisons_total{outcome="operational_error"}[5m]))
/
sum(rate(formbricks_authzed_authorization_comparisons_total[5m]))

# Comparison latency p95 by mode, surface, and outcome.
histogram_quantile(
  0.95,
  sum by (le, mode, surface, outcome) (
    rate(formbricks_authzed_authorization_duration_seconds_bucket[5m])
  )
)
```

The following was the historical comparison acceptance criterion. It is retained only to explain old telemetry
and must not be used to authorize a deployment:

1. Run schema validation and a clean apply/repair immediately before the observation window.
2. Observe continuously for seven days and at least 1,000 completed comparisons.
3. Require zero mismatches in either direction, with every earlier mismatch root-caused and resolved.
4. Require an operational-error rate at or below 0.1%.
5. Do not enforce an API-key target while any API-key mismatch remains.
6. Historical only: move the approved target/cohort from shadow to enforcement and restart the deployment.

That configuration-only rollback is also superseded. The direct-authority image contains no evaluator switch;
rollback is redeployment of the pinned bridge image followed by outbox drain and a clean audit.

## 7. Direct-authority cutover

The full approval contract is [`CUTOVER.md`](./CUTOVER.md). This section is the operator's execution checklist.

### Freeze the bridge artifact

After the transactional outbox passes its crash, lease, duplicate, ordering, dead-letter, replay, outage, and
scheduled-repair tests:

1. Build the bridge and record its source commit, immutable application digest, schema digest, Prisma migration
   head, SpiceDB digest, and operator/chart versions.
2. Verify it reads the final outbox migration and canonical schema.
3. Keep legacy authorization authoritative, set `AUTHZED_CONSISTENCY=fully_consistent`, and remove shadow,
   enforcement-target, cohort, and minimum-snapshot configuration.
4. Preserve this exact digest as the rollback artifact through production.

### Establish the graph

Deploy the bridge first. Drain the outbox, run a full dry-run audit, apply repair, and require two consecutive
clean audits plus one clean scheduled six-hour audit. Exercise mutation delivery while SpiceDB is unavailable,
restore it, and prove replay returns to a clean graph without a dead letter.

### Cut an environment to direct authority

1. Freeze authorization mutations for no more than 15 minutes.
2. Drain the outbox and run the final full audit.
3. Abort if both are not complete and clean within 10 minutes.
4. Deploy the exact approved direct-authority digest and verify every running image ID.
5. Verify `fully_consistent` configuration and confirm no legacy evaluator or migration rollout selector is
   present.
6. Resume mutations and execute critical allow, deny, revocation, cross-tenant, list, API/MCP/UI, and failure
   checks.

The mandatory order is sandbox, staging, EU, and then KSA. Sandbox must pass rollback/forward recovery and 24
continuous healthy hours. Staging must pass complete functional, restore, resilience, and capacity suites plus a
seven-day authoritative soak. EU must remain healthy for 24 hours before KSA begins.

### Roll back

1. Freeze authorization mutations again.
2. Capture bounded failure evidence.
3. Redeploy the exact pinned bridge digest and verify image IDs.
4. Verify legacy authority and durable outbox delivery.
5. Drain pending work and require a clean full audit.
6. Resume mutations.

Do not downgrade the SpiceDB schema or outbox migration during a normal application rollback. Restore the
datastore only through the backup/restore runbook, then apply the guarded release schema and rebuild/repair the
graph before another cutover.

Abort before or after cutover for a non-clean audit, pending/dead-letter/stale revocation, digest mismatch,
incomplete backups or restore evidence, unavailable rollback artifact, cross-tenant decision, unexpected allow or
deny, exceeded operational-error/latency budget, stopped outbox delivery, freshness-guard activation, or open
high/critical security finding.

## 8. Alerting

The checked-in metrics below cover the current migration bridge. ENG-2408 and ENG-2451 must add authoritative
decision latency/error, outbox backlog and oldest-item, revocation age, dead-letter, scheduled-audit, drift, and
repair metrics before direct authority. Their required thresholds are:

- pending revocation warning at 15 seconds;
- pending revocation critical at 45 seconds;
- protected authorization fail-closed guard at 60 seconds;
- any dead-letter revocation is critical and blocks cutover;
- any scheduled residual drift is warning, and stale higher permission or cross-tenant drift is critical; and
- direct-authority operational-error rate above 0.1%, p95 above 250 ms, or p99 above one second blocks the staging
  soak.

Existing bridge rules follow. Thresholds are starting points — tune non-gate alerts to deployment size.

```promql
# Warning: projections are failing. Drift is accumulating and a backfill will be needed.
sum(rate(formbricks_authzed_projection_total{status="failed"}[5m])) > 0
# for: 15m

# Critical: SpiceDB is unreachable rather than slow.
sum(rate(formbricks_authzed_request_failures_total{code="authzed_unavailable"}[5m])) > 0
# for: 10m

# Warning: degraded, not down. Often connection-pool pressure — check pgxpool_empty_acquire.
sum(rate(formbricks_authzed_request_retries_total[5m]))
  / sum(rate(formbricks_authzed_projection_total[5m])) > 0.1
# for: 15m

# Critical: AuthZed is switched off where it is expected to be on.
sum(rate(formbricks_authzed_projection_total{status="disabled"}[15m])) > 0
# for: 30m

# Warning: projection latency is on the request path.
histogram_quantile(0.95, sum(rate(formbricks_authzed_projection_duration_seconds_bucket[5m])) by (le)) > 0.5
# for: 15m
```

Every one of these resolves to the same first action: inspect and drain the durable outbox, then run the full
audit and confirm a clean result. On a pre-outbox bridge, run the backfill immediately because failed writes were
not retained.

A Helm `PrometheusRule` template shipping these by default is deliberately not part of this change —
that belongs with the AuthZed deployment contract rather than the application.

## 9. Escalation

| Situation                                                | Action                                                                                                                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backfill reports `failures` that persist across runs     | Capture the `code` values and the run's JSON. A non-retryable code (`authzed_unauthenticated`, `authzed_permission_denied`, `authzed_invalid_request`) is a configuration problem, not a transient one. |
| Orphan count exceeds the cap and the endpoint is correct | Do not raise the cap. Establish why first — a wrong database or an in-progress restore both look like this.                                                                                             |
| `unmanaged` relationships reported                       | Something other than Formbricks is writing to this SpiceDB, or the schema moved ahead of its projector. Never pruned; investigate before enforcing.                                                     |
| Schema check reports `drifted`                           | `pnpm authzed:schema apply --expected-current-digest <remoteDigest>`. Relationship repair against a drifted schema is not meaningful.                                                                   |
| Durable delivery or a clean graph cannot be restored     | Block cutover. If already authoritative, roll back to the pinned bridge digest, drain/replay, and require a clean audit before another attempt.                                                         |
