# Plan: Workflows PoC Vertical Slice

| Field     | Value                                                                |
| --------- | -------------------------------------------------------------------- |
| Status    | Done                                                                 |
| Owner     | Javier Aguilar                                                       |
| Milestone | [001 Workflows MVP](../../blueprint/milestones/001-workflows-mvp.md) |

## Goal

Implement the architecture-faithful Workflows proof of concept as one clean stopping point for demo
and learning.

This plan orchestrates the PoC by referencing the relevant subsets of the existing MVP plans instead
of repeating their full detail. Plans 001-002 through 001-009 remain the full MVP/Beta backlog and
should not be marked done when this PoC ships.

## How To Use This Plan

This is a coding-agent orchestration plan, not a replacement for the detailed implementation plans.
Before coding, use the linked plan docs and decisions below as targeted references. Search/open the
sections relevant to the phase you are implementing rather than reading every linked plan end to end.
Use this plan as the scope filter: when a detailed plan describes the full MVP/Beta target, implement
only the subset allowed here and defer anything that Decision 003 or this plan explicitly excludes.

The implementation order is:

- Read the governing decisions, business rules, diagrams, and design guide.
- Complete or consume the readiness artifacts from [001-000](./001-000-prototype-readiness-and-contracts.md).
- Implement the PoC by taking the relevant subset of [001-002](./001-002-api-requirements-and-openapi-contract.md)
  through [001-007](./001-007-run-observability-audit-and-dry-runs.md).
- As each referenced plan subset is implemented, update the relevant plan, milestone, checkpoint,
  checks, and manual QA docs so status and delivered scope do not go stale. Mark only the completed
  phases or sub-scope as complete; do not mark a full MVP/Beta plan done just because its PoC subset
  shipped.
- Treat [001-008](./001-008-followups-webhooks-migration-and-qa.md) as context only; migration is
  explicitly out of scope.
- Use [001-009](./001-009-mvp-feedback-and-beta-iteration.md) only after the PoC is demoed and a
  checkpoint exists.

## Governing Decisions And Rules

- [Decision 003 — Workflows MVP is a Proof of Concept](../../blueprint/decisions/003-workflows-mvp-is-proof-of-concept.md)
  is the binding scope decision for this plan.
- [Decision 001 — Workflows API-first backend contract](../../blueprint/decisions/001-workflows-api-first-backend-contract.md)
  is binding for the PoC: use v3 route handlers, no Next.js server-action workflow workarounds, and
  no dashboard-only workflow behavior.
- [Decision 002 — Workflows technical architecture](../../blueprint/decisions/002-workflows-tech.md)
  is binding for the architecture: React Flow, shared client-safe zod schemas, BullMQ under
  `packages/jobs`, separate definition/run records, and JSON-derived canvas state.
- [Decision 004 — Workflows builder state management](../../blueprint/decisions/004-workflows-builder-state-management.md)
  is binding for the builder state model: scoped Jotai + Immer for PoC editor-local state, workflow
  JSON as source of truth, and React Hook Form / TanStack Query only as conditional Beta tools when
  they provide concrete benefits.
- [Business rule 001 — Workflows glossary and scope](../../blueprint/business-rules/001-workflows-glossary-and-scope.md)
  defines lifecycle values, run statuses, scope, permissions, and full MVP/Beta rules.
- [Architecture diagrams](../../research/docs/diagrams.md) describe the target architecture. For PoC
  implementation, follow the architecture shape but honor the explicit deferrals in Decision 003.
- [Workflows design guidelines](../../blueprint/guidelines/design-guidelines-workflows.md) define the builder
  look and feel, component reuse expectations, canvas/drawer model, and run visibility patterns.

## Detailed Plan Source Map

- [001-000 PoC readiness and missing contracts](./001-000-prototype-readiness-and-contracts.md):
  endpoint inventory, schema sketch, persistence/job sketch, IA choice, trigger-hook notes, and
  imported prototype-logic review. Do not start coding until these are available or intentionally
  resolved inline.
- [001-002 API requirements and OpenAPI contract](./001-002-api-requirements-and-openapi-contract.md):
  API method/path/request/response/error-shape thinking. PoC implements only workflow CRUD,
  enable/disable, and run list/detail as HTTP endpoints; trigger enqueue is a server-only contract
  called from the response pipeline. OpenAPI generation and full parity polish are deferred.
- [001-003 workflow schema, data model, and permissions](./001-003-workflow-schema-data-model-and-permissions.md):
  workflow JSON, shared zod contracts, lifecycle/run vocabularies, workspace scoping, and separate
  definition/run persistence. PoC defers version snapshots, indexing hardening, and broad
  permission-denial coverage.
- [001-004 execution engine and jobs](./001-004-execution-engine-and-jobs.md):
  BullMQ/job-system placement, graph walking, run updates, and worker boundaries. PoC uses one local
  queue/worker and one-pass execution; retries, idempotency, batching, and production concurrency are
  deferred.
- [001-005 MVP triggers and actions](./001-005-mvp-triggers-and-actions.md):
  trigger/action shape and action contracts. PoC implements Response Completed, If/Else, Send Email
  preview, and Send Webhook preview with the fixed envelope; Compute, AI, extra triggers, and real
  side effects are deferred.
- [001-006 dashboard workflow builder UI](./001-006-dashboard-workflow-builder-ui.md):
  dashboard routes, React Flow builder, fixed/collapsible drawer, client-side shared-schema
  validation, and API client integration. PoC implements the minimal list/builder/run surfaces and
  manual demo flow; Playwright and full UI hardening are deferred.
- [001-007 run observability, audit, and dry runs](./001-007-run-observability-audit-and-dry-runs.md):
  run visibility expectations. PoC implements status, timestamps, step outputs, and failure message
  in run list/detail; audit logs, dry-run endpoint/UI, retention, and full logs are deferred.
- [001-008 follow-ups, webhooks, migration, and QA](./001-008-followups-webhooks-migration-and-qa.md):
  context for future migration only. Existing Follow-ups and Webhooks stay untouched in the PoC.
- [001-009 PoC feedback and beta iteration](./001-009-mvp-feedback-and-beta-iteration.md):
  post-PoC review plan. Use it after Phase E to decide what moves into Beta.

## Definition of Done

- A user can create a workflow through the v3 API and see/edit it in the dashboard.
- Workflow JSON is validated with shared client-safe zod schemas.
- React Flow state is derived from workflow JSON, not a separate source of truth.
- A user can enable and disable the workflow through v3-backed controls.
- A Response Completed event creates a run for matching enabled workflows.
- A BullMQ worker executes the If/Else path and produces no-send Email/Webhook preview outputs.
- Run list/detail show status, timestamps, step outputs, and a failure message.
- Disabling the workflow prevents new runs.
- No real email or webhook calls are sent.
- A checkpoint is written after the PoC to decide what moves into Beta.

## Out of Scope

- Real Send Email or Send Webhook side effects.
- Idempotency, retries, backoff, batching, worker topology, and production concurrency decisions.
- Audit logs, dry-run endpoint/UI, retention policy, version snapshots, rollback UI, and OpenAPI
  generation.
- Playwright E2E, i18n validation, migration of existing Follow-ups/Webhooks, and no-regression
  migration guarantees.
- Rewriting plans 001-002 through 001-009 as PoC/Beta split plans.

## Phases

| Phase | Scope                                 | Acceptance Checks                                                                                                                                                                                                                                                                                                                                                                                                                                          | Status |
| ----- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| A     | Readiness and contract alignment.     | Consume [001-000](./001-000-prototype-readiness-and-contracts.md) for endpoint inventory, schema sketch, persistence/job sketch, IA choice, trigger-hook notes, and PoC boundaries. Any contradiction with [Decision 003](../../blueprint/decisions/003-workflows-mvp-is-proof-of-concept.md) is resolved before coding.                                                                                                                                   | Done   |
| B     | Minimal API, schema, and data model.  | Implement the PoC subset of [001-002](./001-002-api-requirements-and-openapi-contract.md) and [001-003](./001-003-workflow-schema-data-model-and-permissions.md): workflow CRUD, enable/disable, run list/detail HTTP endpoints, server-only trigger enqueue, shared zod contracts, and separate workflow definition/run records. Defer OpenAPI, pagination hardening, full error model, version snapshots, indexes, and broad permission-denial coverage. | Done   |
| C     | Minimal execution and action set.     | Implement the PoC subset of [001-004](./001-004-execution-engine-and-jobs.md) and [001-005](./001-005-mvp-triggers-and-actions.md): one local BullMQ queue/worker, graph walk, `queued` -> `running` -> `completed`/`failed`, Response Completed trigger, If/Else, Send Email preview, and Send Webhook preview with fixed envelope. Defer real side effects, retries, idempotency, Compute, AI, and extra triggers.                                       | Done   |
| D     | Minimal dashboard and run visibility. | Implement the PoC subset of [001-006](./001-006-dashboard-workflow-builder-ui.md) and reference [001-007](./001-007-run-observability-audit-and-dry-runs.md) only for run visibility expectations: workflows list, React Flow canvas, fixed/collapsible drawer, run list, and run detail. Defer dry-run, audit, retention, full logs, Playwright, and migration work from [001-008](./001-008-followups-webhooks-migration-and-qa.md).                     | Done   |
| E     | Final review pass.                    | Checks and manual demo are recorded. Existing MVP/Beta plans remain Proposed. A checkpoint captures what the PoC proved, which shortcuts hurt, and what should move into Beta.                                                                                                                                                                                                                                                                             | Done   |

## Test and Validation Plan

- Unit tests for shared schema validation.
- Unit tests for graph execution and If/Else branch selection.
- Minimal API tests for workflow CRUD, enable/disable, run list/detail.
- Worker test for `queued` -> `running` -> `completed`/`failed`.
- Manual demo flow replaces Playwright for this PoC.
- Defer OpenAPI generation, Playwright, i18n validation, retry/idempotency tests, audit tests, and
  real side-effect tests.

Use [CHECKS.md](../../blueprint/CHECKS.md) for command selection once implementation files exist.

Final PoC checks are recorded in
[checkpoint 001-010](../checkpoints/001-010-workflows-poc-vertical-slice.md).

## Manual QA Impact

Manual QA for this PoC is a demo script, not the full MVP QA matrix:

- Create a workflow.
- Configure Response Completed -> If/Else -> Send Email preview / Send Webhook preview.
- Enable the workflow.
- Trigger a matching Response Completed event.
- Inspect the run list/detail and confirm preview outputs.
- Disable the workflow and confirm a later matching event does not create a new run.
- Confirm no real email or webhook call is sent.

Record full Beta QA follow-ups in [MANUAL_QA.md](../../blueprint/MANUAL_QA.md) after the PoC
checkpoint decides the Beta scope.

Final manual demo notes are recorded in
[checkpoint 001-010](../checkpoints/001-010-workflows-poc-vertical-slice.md).

## Changelog Impact

Category: Added

Note: Adds the first clickable Workflows proof of concept behind the accepted architecture, without
production side effects.

## Circuit Breakers

- Stop if the implementation bypasses v3 route handlers, uses server actions as the workflow backend
  contract, or creates dashboard-only workflow behavior.
- Stop if React Flow state becomes the source of truth instead of workflow JSON.
- Stop if shared schemas require server-only imports.
- Stop if the worker sends real email or outbound webhook requests.
- Stop if config and run records collapse into one persisted source.
- Stop if scope expands into dry-run, audit, real side effects, retries, idempotency, OpenAPI,
  Playwright, or Follow-ups/Webhooks migration before the PoC checkpoint.
- Stop after two repeated failures of the same check without new evidence or a changed approach.

## Risk Notes

- The main risk is quietly turning the PoC into the full MVP. This plan should stop at the demo slice
  and produce a checkpoint before Beta hardening.
- The opposite risk is building a throwaway demo. The PoC must still validate the target architecture:
  v3 API, shared schemas, BullMQ, separate definition/run records, and JSON-derived React Flow state.
- Existing Follow-ups and Webhooks remain untouched; any migration or no-regression work belongs after
  the PoC checkpoint.

## Decision-Record Check

- Governed by [003 Workflows MVP is a Proof of Concept](../../blueprint/decisions/003-workflows-mvp-is-proof-of-concept.md).
- Uses [001 Workflows API-first backend contract](../../blueprint/decisions/001-workflows-api-first-backend-contract.md).
- Uses [002 Workflows technical architecture](../../blueprint/decisions/002-workflows-tech.md).
- Uses [004 Workflows builder state management](../../blueprint/decisions/004-workflows-builder-state-management.md).
- Create a new decision only if the PoC discovers a durable architecture change, not for local
  sequencing or implementation details.

## Documentation Updates

- Add a checkpoint after Phase E with findings and Beta recommendations.
- When a PoC implementation completes a subset of a referenced plan, update that plan's phase/status
  notes or add a checkpoint entry that says exactly what shipped, what remains Beta work, and which
  tests/manual QA covered it.
- Keep [001 Workflows MVP](../../blueprint/milestones/001-workflows-mvp.md), [MILESTONES.md](../../blueprint/MILESTONES.md),
  [CHECKS.md](../../blueprint/CHECKS.md), and [MANUAL_QA.md](../../blueprint/MANUAL_QA.md) aligned
  with implemented behavior so future agents do not read stale status.
- Update [001 Workflows MVP](../../blueprint/milestones/001-workflows-mvp.md) only if the PoC changes the milestone
  scope or execution order.
- Update business rules, decisions, checks, or manual QA only if implementation changes product
  behavior, architecture, verification, or QA expectations beyond this plan.

## Final Review

- Checks run and recorded in [checkpoint 001-010](../checkpoints/001-010-workflows-poc-vertical-slice.md).
- Manual demo passed on 2026-05-22 and is recorded in
  [MANUAL_QA.md](../../blueprint/MANUAL_QA.md). The pass used the dashboard for create, builder,
  enable, run list/detail, and disable, and used a workflow-run-only BullMQ enqueue to avoid
  invoking legacy response pipeline side effects.
- Checkpoint written.
- Referenced plans/checkpoints/status notes updated for the parts actually implemented.
- Existing full MVP/Beta plans left Proposed unless separately implemented.
- Follow-ups captured for Beta.

- [x] Reviewed and refined by: Javier Aguilar
