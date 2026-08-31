# Direct AuthZed cutover contract

This document is the single approval contract for moving the current Formbricks authorization model to
AuthZed/SpiceDB. It supersedes the earlier shadow/cohort rollout proposal. The implementation and deployment
runbooks may add detail, but they must not weaken these requirements.

The contract covers the current 35-action authorization vocabulary only. Phase 2 sharing and contextual
authorization capabilities are separate product work.

## Decision

SpiceDB becomes the sole authorization decision engine. PostgreSQL remains the business record for users,
memberships, roles, teams, workspace grants, API-key scopes, feedback directories, and every other fact that is
projected into SpiceDB.

The release uses two immutable application artifacts:

| Artifact                   | Authority        | Purpose                                                                                                                                                  |
| -------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Projection bridge          | Legacy evaluator | Delivers every committed relationship change durably, establishes and audits the graph, and is the deployment rollback artifact.                         |
| Direct-authority candidate | SpiceDB          | Evaluates every scalar and list authorization decision, fails closed on operational errors, and contains no runtime legacy evaluator or shadow selector. |

There is no shadow release phase. Comparison telemetry may remain temporarily in a bridge build while the
direct-authority code is being developed, but it is not a rollout gate and must not be configured in sandbox,
staging, or production for this cutover.

## Invariants

The following are release-blocking invariants:

1. Every authorization-relevant PostgreSQL mutation and its projection-outbox event commit atomically.
2. Relationship delivery is idempotent and at least once. A process crash or SpiceDB outage cannot silently lose
   a committed grant, downgrade, or revocation.
3. A pending revocation emits a warning at 15 seconds, a critical alert at 45 seconds, and makes protected
   authorization fail closed at 60 seconds.
4. Every `can()` and `assertCan()` call, including calls outside a request surface, uses SpiceDB in the
   direct-authority artifact.
5. Organization and workspace access lists use bounded SpiceDB resource lookup rather than one permission check
   per result or legacy role/grant SQL as the authorization decision.
6. Permission checks use `fully_consistent` consistency. No cutover environment uses a backfill snapshot as a
   shadow freshness floor.
7. A genuine SpiceDB denial remains a product denial. Configuration, scope-resolution, transport, freshness,
   datastore, and unsupported-result failures are operational errors and fail closed.
8. Formbricks `/health`, application startup, readiness, and liveness remain independent from SpiceDB. Protected
   operations fail closed without causing unrelated workloads to restart.
9. Logs, metrics, command output, and alerts never expose tokens, database credentials, raw SDK errors, schema
   contents, relationship strings, or actor/resource/tenant identifiers unless an operator explicitly runs the
   sensitive relationship-audit command and protects its output.
10. The direct-authority artifact contains no environment switch or runtime code path that can select the legacy
    evaluator. Rollback is a deployment action.

## Durable relationship delivery

The projection bridge writes an outbox row in the same Prisma transaction as the source mutation. PostgreSQL is
the durable queue; BullMQ is only the recurring trigger that wakes workers.

Workers claim rows with leases and `FOR UPDATE SKIP LOCKED`, reconcile the complete current PostgreSQL state for
the affected target, and acknowledge the row only after the SpiceDB write succeeds. Delivery is safe under
duplicate, reordered, delayed, and concurrently claimed events because reconciliation is idempotent and derives
the desired state from PostgreSQL rather than trusting an event payload as current truth.

An item is attempted at most 20 times before entering dead letter. Operators must be able to inspect sanitized
status, drain pending work, and replay dead letters through the release-matched `formbricks-authzed` CLI. A full
audit runs every six hours. Automatic repair is limited to attributable missing and mismatched relationships;
unknown, cross-tenant, unmanaged, and unsafe destructive findings require manual investigation.

Revocations include deletion, deactivation, membership removal, role or permission downgrade, replacement of a
grant set, removal of an API-key scope, and parent/resource deletion cascades. Classification is conservative:
when a mutation could reduce access, the outbox treats it as a revocation.

## Artifact freeze and compatibility

After the durable bridge passes its implementation gates:

1. Build the bridge once and record the application image digest, source commit, schema digest, Prisma migration
   head, SpiceDB image digest, and operator/chart versions.
2. Prove that this exact image can read the final outbox migration and final current-model schema.
3. Keep legacy authorization authoritative, set AuthZed consistency to `fully_consistent`, and remove all shadow
   and enforcement target configuration.
4. Preserve the digest through sandbox, staging, and production as the only authorized application rollback
   artifact.

The direct-authority candidate is built after scalar authorization, list lookup, authoritative telemetry,
legacy-code removal, and upgrade preflight work is complete. Sandbox, staging, EU, and KSA use the same immutable
candidate digest wherever platform architecture allows. When a different platform manifest is necessary, every
platform image must be produced by the same multi-architecture build and verified against its OCI index digest.

Any code change affecting authorization, projection, schema, Prisma, authentication, or tenant isolation creates
a new candidate and resets the applicable soak window.

## Environment sequence and gates

### Sandbox bridge

The existing `authzed-sandbox` namespace is the first deployment target. Before direct authority:

- verify private networking, pinned SpiceDB/operator versions, datastore migrations, backups, credentials, and
  database connectivity;
- deploy the immutable bridge digest and guarded canonical schema digest;
- drain the outbox, reconcile the complete graph, and require two consecutive clean audits;
- observe one clean scheduled six-hour audit;
- create mutations during a SpiceDB outage, restore it, and prove replay converges without dead letters; and
- verify the complete owner/manager/member/billing, team, workspace, API-key, resource, and cross-tenant fixture.

### Sandbox direct authority

The sandbox cutover uses the same procedure as later environments:

1. Freeze authorization mutations for no more than 15 minutes.
2. Drain the outbox and run the final full audit.
3. Abort if drain and audit are not complete and clean within 10 minutes.
4. Deploy the direct-authority candidate digest and verify every running pod's image ID.
5. Verify `fully_consistent` configuration and the absence of legacy, shadow, enforcement-target, cohort, and
   minimum-snapshot configuration.
6. Resume mutations and execute functional, failure, recovery, backup/restore, and cross-tenant QA.
7. Redeploy the exact bridge digest, verify legacy authority and a clean graph, then redeploy the candidate and
   repeat critical allow, deny, revocation, and isolation checks.
8. Require 24 continuous healthy hours after the final forward deployment.

Staging work is blocked by any unexpected decision, unexplained operational error, dead letter, normal-operation
60-second freshness guard, non-clean scheduled audit, rollback/recovery failure, or identifier/secret leak.

### Staging

Staging receives production-like private SpiceDB infrastructure with two replicas, a PodDisruptionBudget,
topology spread, dedicated PostgreSQL credentials, backups, and point-in-time recovery. It uses the sandbox-
validated bridge and candidate digests and the same schema digest.

After establishing a clean graph, staging performs the controlled cutover, complete UI/API/MCP/gateway and
failure/restore/capacity suites, and a seven-day authoritative soak. The gate is:

- no unexplained authorization decisions or operational errors above 0.1%;
- no dead-letter revocations or freshness-guard activation;
- clean scheduled audits;
- authorization p95 below 250 ms and p99 below one second;
- capacity at observed concurrency with at least 2x headroom; and
- successful outage, restore, rollback, and forward-recovery exercises.

At the end of the soak, integrate the newest `main`, rerun all automated checks, and deploy the refreshed
candidate for 24 hours. Restart the seven-day window when that refresh changes authorization-sensitive code.

### Production

EU/EKS and KSA/GKE are independent production change windows with separate databases, backups, evidence, abort
decisions, and approvals. Each runs three SpiceDB replicas and passes the same capacity, restore, graph, and
rollback gates.

Cut EU first. KSA cannot cut over until EU has completed at least 24 healthy hours on the approved application,
SpiceDB, and schema versions. After both regions cut over, run seven days of production hypercare with recurring
clean audits and revocation-delivery evidence.

## Cutover abort triggers

Abort before deploying the direct-authority image when any of the following is true:

- the mutation freeze would exceed 15 minutes;
- outbox drain or the final audit does not complete within 10 minutes;
- the audit is not clean or contains cross-tenant, unmanaged, invalid, mismatched-parent, or stale higher-
  permission findings;
- any revocation is pending, dead-lettered, or older than its SLA;
- the schema or image digest differs from the approved evidence;
- backups, restore evidence, credentials, private networking, or monitoring are incomplete;
- a high/critical security finding is open; or
- the bridge rollback artifact cannot be pulled and started.

Abort after deployment and roll back when protected operations produce unexpected decisions, operational-error
budgets are exceeded, cross-tenant isolation fails, outbox delivery stops, the 60-second guard activates, the
SpiceDB/datastore topology cannot recover within the change window, or the running digest/configuration does not
match the approved artifact.

## Rollback

Rollback means redeploying the pinned bridge digest. It does not mean changing an environment selector in the
direct-authority image.

1. Re-freeze authorization mutations.
2. Capture the candidate's sanitized authorization, outbox, and reconciliation evidence.
3. Redeploy the exact bridge digest and verify running image IDs.
4. Verify legacy decisions are authoritative and durable outbox delivery is still active.
5. Drain pending work and require a clean full audit.
6. Resume mutations.

Do not roll back the SpiceDB datastore or canonical schema as part of the normal application rollback. The bridge
must remain compatible with the final outbox migration and schema. Restore the datastore only under the separate
backup/restore procedure, then reapply the guarded release-matched schema and rebuild/repair the graph before any
later direct-authority attempt.

## Failure behavior

| Failure                                      | Bridge artifact                                                                                                        | Direct-authority artifact                                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| SpiceDB or datastore unavailable             | PostgreSQL mutation commits with its durable outbox row; legacy authorization remains authoritative; delivery retries. | Protected authorization returns a sanitized operational failure and fails closed; `/health` remains independent.      |
| Redis/BullMQ unavailable                     | PostgreSQL outbox continues accumulating; a later trigger resumes delivery.                                            | Existing graph decisions continue until revocation age reaches 60 seconds, then protected authorization fails closed. |
| Worker crashes after source commit           | Leased event becomes reclaimable and is reconciled idempotently.                                                       | Same; freshness guard limits stale-revocation exposure.                                                               |
| Event is duplicated or reordered             | Reconciliation reads current PostgreSQL state and converges.                                                           | Same.                                                                                                                 |
| Item enters dead letter                      | Alert and block cutover.                                                                                               | Fail closed for protected authorization until replay and clean audit.                                                 |
| AuthZed configuration is disabled or invalid | Bridge deployment is unhealthy for migration purposes; do not cut over.                                                | Typed operational error; no legacy fallback.                                                                          |

## Self-hosted v6 contract

Fresh Docker, one-click, and Helm v6 installations enable bundled or external AuthZed by default. Existing Helm
installations require explicit migration acknowledgement. Existing Docker/one-click/custom Helm installations
must first run the bridge-compatible v5 migration, apply the release-matched schema, drain/reconcile the outbox,
and pass the upgrade preflight and final clean audit.

The v6 application never silently starts protected authorization without a valid AuthZed configuration and clean
upgrade state, and it never falls back to legacy authorization. The preflight checks configuration, health,
datastore migrations, schema digest, outbox state, full dry-run audit, repair result, and backup/rollback evidence.

Keep the moving `latest` image tag on v5 for at least 30 days after v6 stable publication. Publish the v6 stable
tag only after production, self-hosted, documentation, security, and rollback gates pass.

## Evidence and approvals

Each environment change record must retain:

- source commit; application, SpiceDB, and operator image digests; schema digest; and migration head;
- backup and restore identifiers without secret values;
- outbox status/drain, two clean audits, and scheduled-audit evidence;
- functional, API/MCP/UI, cross-tenant, failure, rollback, and recovery results;
- bounded decision/error/latency/capacity metrics for the required soak;
- exact mutation-freeze start/end times and abort evaluation; and
- explicit product, security, infrastructure, and operations approvals.

Product approves parity with the current authorization matrix. Security approves fail-closed, tenant-isolation,
revocation, and secret-handling evidence. Infrastructure approves topology, private networking, capacity,
datastore, backups, and restore. Operations owns the change window, drain/audit execution, abort decision,
rollback, and post-cutover observation.

## Workstream ownership

| Workstream                                           | Tickets                                                              |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| Contract and repository integration                  | ENG-2448, ENG-2447                                                   |
| Durable bridge                                       | ENG-2408                                                             |
| Direct-authority application                         | ENG-2446, ENG-2449, ENG-2451, ENG-2450, ENG-2452                     |
| Sandbox graph and cutover                            | ENG-2469, ENG-2470                                                   |
| Staging infrastructure, graph, cutover, QA, and soak | ENG-2454, ENG-2458, ENG-2455, ENG-2364, ENG-2457, ENG-2453, ENG-2456 |
| Production readiness and regional cutover            | ENG-2459 through ENG-2467                                            |
| Hypercare and stable release                         | ENG-2468                                                             |

The project's earlier shadow-mode proposal and rollout documentation are retained only as historical context.
They are not an approved release path. The architecture RFC at
<https://app.notion.com/p/398e5de84a588184a79fe9ef5d07811e> and every implementation/rollout ticket must
link to this contract when they are next updated.
