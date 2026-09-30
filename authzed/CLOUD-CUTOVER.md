# Cloud bridge and cutover

Cloud and self-hosting have different rollout procedures but the same final application: SpiceDB is the sole
authorization engine and PostgreSQL supplies relationship facts through the durable outbox.

Self-hosters use the [maintenance-window upgrade](../docs/self-hosting/advanced/v6-maintenance-upgrade.mdx).
Cloud may keep ordinary traffic available during preparation using a temporary bridge artifact. These are
required gates, not evidence that an existing artifact or environment has passed them.

## Availability contract

Online backfill plus a rolling deployment is not sufficient to promise zero downtime. A fully consistent
SpiceDB check sees the graph in SpiceDB, not source changes still pending in the PostgreSQL outbox.

The Cloud target is continued reads and independently verified respondent traffic, with a short announced
pause of authorization-changing writes. This is a partial service restriction, not strict zero downtime.
Signup, invitations, role/grant changes, resource creation/deletion/moves, API-key scope changes, and dataset
assignment/archive changes all modify authorization state. HTTP methods or UI controls alone do not identify
this set: inspect all write paths and background jobs.

If safe selective quiescence cannot be demonstrated, use full maintenance. Never accept stale privileges or
silently fall back to legacy authorization to meet an availability claim.

## Create and freeze the bridge

1. Select exact Cloud source and target commits. Review **all** intervening database migrations; online
   preparation permits only changes compatible with the running source application. Incompatible changes
   require expansion/contraction work or maintenance first.
2. Create a separate temporary Cloud release branch from the source application. Add the tested transactional
   outbox and projection/repair compatibility needed by the final graph, retaining its legacy evaluator.
   Verify every source writer is captured, including cascades and direct SQL. No legacy evaluator or
   build-time engine selector is merged back into normal v6 source.
3. Build a single-purpose bridge image. Record its immutable digest, source commit, outbox migration head,
   schema digest, configuration, and dependencies. Verify compatibility with the **final** application
   database/schema, including data created by v6 after cutover.
4. Rehearse rollback and forward recovery with those artifacts. Existing bridge images are candidates, not
   automatically compatible rollback artifacts. Keep the temporary source branch and immutable image, rather
   than maintaining two variants in the normal release pipeline.

Assign an owner and removal date before deployment. The bridge is legacy-authoritative by construction, not
selected by a runtime switch. Never publish it as `latest` or as the normal self-hosted v6 image.

## Prepare while the bridge serves traffic

Deploy the bridge across every source-writing workload before treating the outbox as complete. Verify actual
image IDs and private SpiceDB connectivity. Freeze permission-model/schema changes for the rollout and review
any other release for compatibility.

Apply the reviewed schema, backfill, drain, and audit. Require two clean audits and a clean scheduled audit.
Test mutations during outages, duplicate delivery, lease recovery, cascades, downgrade/revocation delivery,
and cleanup of team-as-subject edges. Verify reconciliation converges under continued traffic. A clean online
audit is preparation evidence, not the final cutover boundary.

## Pause authorization writes and switch

1. Activate the reviewed environment-specific write pause across APIs, MCP, server actions, imports, workers,
   schedules, and administrative scripts. Drain in-flight authorization transactions and prevent controllers
   from restoring paused writers. Verify unaffected traffic with live requests. If coverage is uncertain,
   abort or use maintenance.
2. Drain all pending projections and require a full clean audit while writers remain paused. There must be no
   pending/dead-letter work, unexplained graph drift, or active authorization writer. Abort after ten minutes
   within the maximum fifteen-minute pause; do not silently extend the window.
3. Deploy the approved v6 digest with capacity for overlapping pods and graceful request draining. Rehearse
   sessions, Next.js server-action/version-skew behavior, APIs, workers, and shared-database compatibility.
   Pod readiness alone is not authorization readiness.
4. Keep writes paused until **all** bridge writers have drained and intended v6 workloads use the verified
   image. Check positive, negative, list, API-key, and cross-tenant decisions through restricted access. Resume
   writes, test revocation delivery, and observe authoritative metrics and audits.

There is no shadow engine, automatic fallback, or activation receipt in v6. The temporary pause belongs to
deployment operations; this change introduces no request-level mutation fences or Prisma-wide interception.
Selective quiescence must be implemented and tested before it can replace maintenance; this runbook is not a
substitute for that implementation.

## Roll back and retire

Rollback is allowed only to the exact bridge proven compatible with the post-cutover database and graph.
Pause authorization writes, drain in-flight work, redeploy the bridge, verify legacy authority and durable
projection, and audit before resuming writes. Otherwise remain in maintenance and use tested backup recovery;
changing an image cannot undo an incompatible database migration.

Follow the sandbox, staging, EU, KSA, and hypercare gates in [RUNBOOK.md](./RUNBOOK.md#7-direct-authority-cutover).
After all environments and the agreed rollback window pass:

- Remove live bridge deployments, temporary pause controls/Jobs, and special GitOps overlays.
- Remove bridge publishing jobs and archive the temporary source branch. Retain immutable images and
  sanitized evidence for the agreed recovery/audit retention period, then garbage-collect them.
- Keep the outbox, projection, reconciliation, freshness guard, SpiceDB evaluator, and operations CLI. They
  maintain authorization after cutover and are not bridge scaffolding.

## Release gates still requiring execution

Record evidence for the exact source/target pair before calling an upgrade supported:

| Gate                            | Required evidence                                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Docker and customized one-click | Fresh install, maintenance upgrade, interruption/retry, and backup restoration preserve volumes/configuration.                   |
| Bundled/managed PostgreSQL Helm | Correct runtime/migration credentials, existing operator ownership, datastore readiness, and read-only upgrade gate.             |
| GitOps                          | Controllers/autoscalers remain paused, existing Jobs drain, and resumption cannot redeploy old writers.                          |
| Cloud online path               | Compatible migrations, complete writer capture, reads/respondents remain available, and write pause/rollback rehearsed.          |
| Release assets                  | Published digest contains the CLI/schema, the supported pair is documented, and floating-tag promotion cannot bypass acceptance. |

No production deployment is authorized by editing this document.
