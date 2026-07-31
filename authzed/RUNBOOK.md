# AuthZed relationship sync runbook

PostgreSQL is the source of truth for authorization. SpiceDB holds a *projection* of it, written after
each source transaction commits, best-effort. That trade-off is deliberate — an AuthZed outage must
never turn a successful PostgreSQL mutation into an application error — and it has one consequence
worth internalizing:

> **Sync failures are silent by design.** Nothing in the product breaks when a projection is dropped.
> Drift accumulates until something reads SpiceDB and disagrees with PostgreSQL.

Everything below exists to make that visible and recoverable.

See also: [README](./README.md) for the projection contract and the backfill command reference.

## 1. Symptoms

| What you see | What it usually means |
| --- | --- |
| Shadow evaluation reports mismatches (ENG-1738) | Drift. Run the backfill. |
| A new member, team, or API key lacks access *in SpiceDB only* | A dropped projection for that record. |
| A removed member still resolves in SpiceDB | A stale relationship. Only pruning removes it. |
| `formbricks_authzed_projection_total{status="failed"}` is non-zero | Projections are failing now. |
| Nothing at all, but AuthZed was recently unavailable | Assume drift. An outage never retries. |

Product authorization is unaffected in every one of these cases while enforcement is still on the
legacy evaluator. That is what makes them easy to miss.

## 2. Diagnosis

### Is AuthZed reachable and correctly configured?

```bash
pnpm authzed:health     # 0 healthy, 1 otherwise
pnpm authzed:schema check   # 0 matched, 2 drifted, 1 failed
```

Note `status: "disabled"` from the health command exits **1**. A deployment that believes AuthZed is on
while `AUTHZED_ENABLED` is off looks healthy by every other signal, which is why the projection metric
records `disabled` as its own outcome rather than skipping.

### Metrics

All four carry only bounded attributes — never an organization, user, or relationship identifier.

| Metric | Attributes | Read it as |
| --- | --- | --- |
| `formbricks_authzed_projection_total` | `operation`, `projection`, `status` | Projection outcomes. `status` is `projected` / `failed` / `disabled`. |
| `formbricks_authzed_projection_duration_seconds` | same | Projection latency. It sits on the request path, so a rise here is user-visible. `disabled` outcomes are deliberately excluded — their duration is a structural zero, not a measurement. |
| `formbricks_authzed_request_failures_total` | `operation`, `code`, `retryable` | Requests that exhausted their retry budget. **Each one is a dropped relationship.** |
| `formbricks_authzed_request_retries_total` | `operation`, `code` | Retries scheduled. Elevated but not failing = degraded, not down. |

Exported through the readers already configured in `instrumentation-node.ts`: Prometheus when
`PROMETHEUS_ENABLED=1` (scraped by the chart's ServiceMonitor), OTLP when
`OTEL_EXPORTER_OTLP_ENDPOINT` is set.

**The backfill command deliberately exports nothing.** It is a short-lived process with no scrape
window; its observability is the counters in its own JSON result and its exit code.

### Logs

Every AuthZed log line carries `component: "authzed"`. Failure lines share a stable field set, so one
query covers all of them:

| Field | Present on | Meaning |
| --- | --- | --- |
| `component` | everything | Always `"authzed"`. |
| `operation` | everything | The facade operation or projection entry point. |
| `status` | projection outcomes | `projected` / `failed`. |
| `errorCode` | every failure | Sanitized `authzed_*` code. Never a raw error. |
| `retryable` | every failure | Whether a retry could have helped. |
| `durationMs` | requests and projections | — |
| `projection` | projection outcomes | Which projector: `organization_membership`, `team_workspace`, `api_key`. |
| `attempts` | projection failures | Total attempts behind the failure. |
| `attemptCount` | request failures/retries | Which attempt this line is about. Distinct from `attempts` above — request layer, not projection layer. |
| `grpcStatus` | request failures/retries | Numeric gRPC status. |
| `errorName` | post-commit boundary only | Error *class* name when a projector itself threw. |

```
component:"authzed" AND status:"failed"
component:"authzed" AND errorCode:"authzed_unavailable"
```

**Identifiers never appear in logs.** No organization, user, team, workspace, or API-key ID; no schema
text; no tokens. If you need to know *which* records drifted, that comes from the backfill's stdout
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
also converges their grants on *other* workspaces. That direction only ever writes what PostgreSQL
says, so the effect is a wider repair than you asked for, never a deletion outside the workspace named.

**Resuming.** A run reports `lastOrganizationId`. Feed it back:

```bash
pnpm authzed:backfill --apply --after-organization-id=<cuid>
```

**Per-unit failures.** One organization failing does not abort the sweep; it lands in `failures` with a
code, and the run exits `1`. Re-running is the fix — successful units simply re-converge.

**`truncated: true`** means an observation was abandoned mid-read. Treat the orphan counts as a floor,
not a total, and re-run before concluding anything.

### Reading the drift counters

- **`missing`** — records PostgreSQL holds that SpiceDB has no relationship for. What an empty or stale
  SpiceDB looks like. Step 2 fixes it. Note it compares *records*, not relations: a membership stored as
  `owner` in PostgreSQL but `member` in SpiceDB counts as present, and step 2 converges it regardless by
  writing the current value.
- **`orphaned`** — relationships whose source record is gone. Only step 3 removes them.
- **`mismatchedParents`** — **treat as a security finding, not routine drift.** A resource is attached to
  an organization PostgreSQL says does not own it. `organization` is a relation, so the edge is *additive*:
  every owner and manager of the named organization has access to that resource through
  `organization->manage`, and no PostgreSQL row explains it. The backfill reports these and deliberately
  never removes them, because deleting a parent edge means deleting a relation the resource legitimately
  needs one of. Confirm the true owner in PostgreSQL, then remove the wrong edge by hand:

  ```bash
  zed relationship delete <childType>:<childId> organization organization:<wrongOrganizationId>
  ```

  Then re-run step 2 to confirm the correct edge is present, and work out how it was written — nothing in
  Formbricks creates one.

  **Only `--scope=all` can find one.** The escalation is an edge on *another* tenant's resource naming
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
not hold. What `--prune` adds is permission to reconcile records observed *only* in SpiceDB.

**A large orphan count is a symptom, not a workload.** Exceeding the per-run cap (500, lowerable with
`--max-prune`, never raisable) prunes *nothing* — not a capped subset — and reports it. Every unit,
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

**Nothing to do urgently.** Projection is best-effort, PostgreSQL stays authoritative, and product
authorization is unaffected. Expect `authzed_unavailable` in logs and a rising failure counter.

What matters is afterwards:

1. Every projection attempted during the outage was dropped and will not be retried.
2. Once SpiceDB is healthy, `pnpm authzed:health` returns `healthy`.
3. Run the backfill (§3). Until it reports a clean run, assume the graph is incomplete.
4. **Keep shadow evaluation and enforcement off until then.** A clean run reports
   `completedAtSnapshot` — hand that revision to shadow evaluation (ENG-1738) as its freshness floor
   rather than guessing whether the graph is warm.

To stop projecting entirely, set `AUTHZED_ENABLED=0`. Projections become no-ops and no client is
constructed; product authorization is untouched because it still runs on the legacy evaluator. Drift
accumulates for the whole period, so a full backfill is required before re-enabling.

## 6. Alerting

Suggested rules. Thresholds are starting points — tune to deployment size.

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

Every one of these resolves to the same first action: **run the backfill and confirm a clean run.**

A Helm `PrometheusRule` template shipping these by default is deliberately not part of this change —
that belongs with the AuthZed deployment contract rather than the application.

## 7. Escalation

| Situation | Action |
| --- | --- |
| Backfill reports `failures` that persist across runs | Capture the `code` values and the run's JSON. A non-retryable code (`authzed_unauthenticated`, `authzed_permission_denied`, `authzed_invalid_request`) is a configuration problem, not a transient one. |
| Orphan count exceeds the cap and the endpoint is correct | Do not raise the cap. Establish why first — a wrong database or an in-progress restore both look like this. |
| `unmanaged` relationships reported | Something other than Formbricks is writing to this SpiceDB, or the schema moved ahead of its projector. Never pruned; investigate before enforcing. |
| Schema check reports `drifted` | `pnpm authzed:schema apply --expected-current-digest <remoteDigest>`. Relationship repair against a drifted schema is not meaningful. |
| Sync cannot be restored and enforcement is pending | `AUTHZED_ENABLED=0` and note that a full backfill is required before re-enabling. |
