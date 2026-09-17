# EU rc.5 temporary Cloud bridge

## Decision and status

Approved on 2026-09-17: create the bridge from **rc.5 product code**, not by backporting v6 product behavior
into v5. Keep legacy authorization confined to this disposable Cloud release branch. Normal v6 remains
SpiceDB-authoritative with no fallback or engine switch.

**Status: strategy recorded, branch created; runtime implementation, image build, and rehearsal pending.**
This document is not deployment approval or evidence that the bridge is ready.

| Artifact                      | Pin / disposition                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| Original EU application       | v5.4.2, source `c5c6ed5f0944f310990e98629419ee9ef602dbc1`                                     |
| Original EU image ID          | `sha256:326357eb8d2a95856dbf9a8c52b937e3bc7214d46ee959fd0e2b5ec997ded437`                     |
| Bridge base and target source | rc.5, `ac7bf6f2104e37b7e0299ddaa5f752f04b3e59a3`                                              |
| Temporary bridge branch       | `bhagya/eu-rc5-product-bridge`                                                                |
| Earlier v5 branch             | `bhagya/eu-rc5-cloud-bridge`; retained as an unmodified reference, not a deployment candidate |
| Final rc.5 image              | `sha256:216b7d5c4e7f2554dd27b216e81150e146774aa8e107a13e26c229bf0659ae8b`                     |
| Bridge image                  | Not built; record its unique immutable digest only after validation                           |

## What the bridge is

The bridge serves **rc.5 product behavior with legacy PostgreSQL-backed authorization decisions**. It is not
v5 with a background projector. Introducing it therefore introduces rc.5's product/data behavior before the
later authorization-engine cutover; review and communicate that first transition as a product deployment.

Preserve rc.5's embedded-data storage and reconciliation, response ingest and anonymization, chart behavior,
authentication, durable projection outbox, workers, repair tooling, and canonical SpiceDB schema. Any
pre-contraction compatibility change must be narrow, documented, and tested against both database states.

Only this temporary branch may contain:

- A hardwired legacy evaluator for all 35 current actions and both actor types. Reuse audited historical
  rules, but retain current actor-validity, resource-existence, tenant, archive, and configurable
  `manage_access` checks. Do not assume an old evaluator is compatible merely because it compiles.
- PostgreSQL-backed organization/workspace authorization lists at the existing list interface. Do not leave
  navigation or API/MCP discovery dependent on SpiceDB, and do not replace lists with N+1 scalar checks.
- Release-specific compatibility and artifact safeguards needed for the migration rehearsal.

The coordinator and list interface select legacy behavior statically. No runtime toggle, shadow comparison,
automatic fallback, activation record, Prisma-wide interception, or permanent request mutation fence is
introduced. Keep the durable outbox/projectors operational with `fully_consistent`; a SpiceDB outage must not
change bridge authorization decisions, while failed projection remains durable and observable.

Use separate bridge deployment/metric identity so its legacy decisions are not counted as evidence of
SpiceDB-authoritative success. Never merge bridge runtime commits into `main`, `release/6.0`, or another
normal product release branch. Review them as a release-artifact diff against the pinned rc.5 base.

## Migration order remains a blocking gate

Changing the source branch does **not** make rc.5 safe to run against the unprepared v5 database or permit
unrestricted rc.5 migrations beside original v5 pods. Keep the original source commit in the reviewed
release migration manifest and record the bridge base separately; do not replace source history with rc.5.

The reviewed expansion artifact must retain original migration names and checksums. Do not modify applied
history or mark an unexecuted migration successful. Explicit preparation commands own migration execution;
disable app startup migrations and automatic deployment migration hooks during the controlled transition.

Prove these gates before any production bridge rollout:

1. The additive embedded-data tables, privacy/ingest columns, and outbox migration are safe under original
   v5 traffic, including bounded database lock time. Only the reviewed subset may run at this point.
2. Original v5 survey edits cannot make embedded-data rows stale during backfill or mixed-version operation.
   Until concurrent-write correctness is demonstrated, pause those product writers before backfill and keep
   them paused until every original v5 writer has drained. Do not claim this work can run online by default.
3. Bridge chart reads tolerate pre-conversion `line` rows and preserve post-conversion `areaDisplay`; bridge
   writes must not emit the removed enum value. Prove this before deferring the chart contraction.
4. Drop the removed survey column and perform other incompatible contractions only after all original v5
   workloads have drained. Check all application, worker, scheduled, import, and administrative writers.
5. Verify the bridge against the final rc.5 database and records created by rc.5, including anonymized
   surveys, typed/locked embedded fields, chart conversions, partial response updates, and exports.

There may be **two controlled product-write pauses**: one for v5 → product-compatible bridge and one for
bridge → SpiceDB authority. Measure and announce both. Each remains subject to the approved target of less
than five minutes, ten-minute preparation abort, and fifteen-minute hard maximum. If either cannot meet the
availability budget in rehearsal, stop and seek a revised maintenance window rather than silently extending
it. Verified read/respondent traffic may continue only where its compatibility and writer safety are proven.

## Build, rehearse, then promote

1. Implement the temporary scalar and list evaluator seams; verify no product decision path still calls the
   SpiceDB evaluator, LookupResources, or projection-freshness guard. Keep all production authorization
   surfaces routed through the same public interfaces, with genuine denials distinct from operational errors.
2. Validate parity against the existing permission matrix, including revoked/inactive actors, cross-tenant
   identifiers, billing, team grants, API-key scopes, feedback assignments, and every list consumer. Confirm
   disabled/unavailable SpiceDB cannot affect a bridge decision while projection errors remain observable.
3. Build a uniquely tagged bridge image from the exact reviewed commit. Record its immutable digest, base,
   migration compatibility, schema digest, dependencies, owner, and retirement date. Do not publish it under
   `latest`, `production`, `stable`, `staging`, a normal semver release, or a self-hosted image alias.
4. Rehearse in a new isolated namespace/database with synthetic EU-like data and outbound delivery blocked.
   Leave Apollo, Artemis, KSA, and EU unchanged. Exercise original v5 → bridge → exact rc.5 → bridge → rc.5,
   including data written after each switch and accepted-response reconciliation.
5. Prove selective writer pause, controller suspension, migration timing, outbox recovery, clean audits,
   Next.js sessions/Server Actions/assets, and graceful draining. Complete the approved 24-hour compatibility
   rehearsal and seven-day authoritative soak; previous artifacts do not supply this bridge's rollback proof.
6. Prepare separate reviewed production preparation, bridge, and cutover changes. Production promotion is
   gated by the measured rehearsal, not by this branch existing or tests passing locally.

Rollback after cutover means redeploying this exact validated **rc.5-product-based bridge** with legacy
authority and continued durable projection. It does not mean reverting the product/database to v5.4.2.
Backup restoration is a separate controlled recovery procedure and cannot discard accepted responses.

Retain the immutable bridge for 30 days after EU acceptance, extending only for an explicitly approved
dependent rollout. Remove temporary deployments, pause controls, overlays and publishing jobs after
acceptance; archive the source branch at retirement. Durable projection, repair and SpiceDB evaluation stay
in normal v6.
