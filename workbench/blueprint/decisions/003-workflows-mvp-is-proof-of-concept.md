# Decision: Workflows MVP Is a Proof of Concept

| Field  | Value          |
| ------ | -------------- |
| Status | Accepted       |
| Date   | 2026-05-22     |
| Owner  | Javier Aguilar |

## Context

Milestone 001 (Workflows MVP), the decisions that feed it
([001 API-first backend contract](./001-workflows-api-first-backend-contract.md),
[002 Workflows technical architecture](./002-workflows-tech.md)), and the surrounding
plans currently read like a production rollout: API-first contract with OpenAPI in sync,
idempotency, retry policies, audit logging from the start, concurrency/backpressure
controls, dry runs, version-snapshot readiness, OpenAPI generation, Playwright E2E
coverage, and a no-regression Follow-ups/Webhooks migration.

That is the right long-term target but the wrong target for the **first** milestone. The
first milestone's job is to **validate the product, design, and engineering hypotheses
end to end** on a single happy-path slice — not to ship a production-grade automation
platform.

If we point the MVP at prod, the most likely failure mode is that we burn weeks on
plumbing (OpenAPI generation, idempotency keys, audit schemas, retry policies, migration
parity) and never reach a clickable canvas, a real trigger event, and observable workflow
execution.

## Decision

Milestone 001 (Workflows MVP) is reframed as a **proof of concept**. Its only purpose is
to validate the workflow architecture, schema, builder UX, and execution model on a
single end-to-end happy path. Production-grade hardening is deferred to a follow-up
milestone (Workflows Beta / Production-Grade).

The long-term decisions in this folder remain **accepted**. The PoC is architecture-
faithful: it still uses v3 route handlers, shared zod schemas, BullMQ execution, separate
workflow definition/run records, and a React Flow builder whose state is derived from the
workflow JSON. The PoC is allowed to defer production hardening, but not to bypass the
target architecture.

### PoC End-to-End Slice

The minimum the PoC must demonstrate:

- One trigger: `Response Completed`.
- Two actions: `Send Email Preview`, `Send Webhook Preview` (fixed envelope; no real
  side effects).
- One flow node: `If/Else`.
- One workflow lifecycle path: `draft` -> `enabled` -> `disabled`. Re-enabling and
  return-to-draft are stretch.
- One run lifecycle path: `queued` -> `running` -> `completed` / `failed`. Cancel is
  stretch.
- A single demo workspace and a single demo survey. Cross-workspace permission denial is
  stretch.
- React Flow canvas, configured workflows list, and a basic run inspector. No version UI,
  no audit UI, no dry-run UI.

Anything beyond this slice is a stretch for the PoC, not a requirement.

### Hypotheses the PoC Must Validate (Do Not Cut These)

These are the load-bearing decisions the PoC exists to test. Cutting any of them
invalidates the PoC.

- Workflow JSON is the source of truth, validated by zod.
- React Flow state is derived from the JSON, not the other way around.
- Workflow operations are exposed through minimal v3 route handlers. The dashboard is a
  client of those route handlers.
- BullMQ + `packages/jobs` is the execution path (no synchronous request-path execution).
- Workflow definitions and workflow runs are stored separately, even if the PoC keeps the
  column/index shape intentionally small.
- Workspace scoping is enforced at the data-access layer, even if the demo only uses one
  workspace.
- The state-machine vocabularies stay as defined
  ([business rules](../business-rules/001-workflows-glossary-and-scope.md)). The PoC may
  exercise a subset of transitions, but it may not invent new statuses.
- The MVP webhook envelope shape (`{ response: <prev output> }`) is the contract under
  test.
- Email and webhook actions are no-send previews. They produce inspectable outputs but do
  not deliver email or make outbound HTTP calls.

### Allowed PoC Shortcuts

Each row below is a production-hardening item the PoC is allowed to defer. The "Revisit
before" column is what reads it back.

| Long-term source                                                                                                                                                                                    | Shortcut allowed in PoC                                                                                                                                                                                                                     | Revisit before  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| [Decision 001](./001-workflows-api-first-backend-contract.md) — "Keep OpenAPI documentation in sync"                                                                                                | PoC does **not** run OpenAPI generation. zod schemas exist for validation; OpenAPI export is deferred.                                                                                                                                      | Beta milestone. |
| [Decision 002](./002-workflows-tech.md) — "Add simple audit logging from the start"                                                                                                                 | PoC ships **no** audit log table. Run state and failure messages are visible through the run record/inspector only.                                                                                                                         | Beta milestone. |
| [Decision 002](./002-workflows-tech.md) — "Prepare internally for workflow versioning, immutable enabled snapshots, rollback/revert"                                                                | PoC stores only the current workflow definition. No `workflow_version` column on runs, no snapshotting.                                                                                                                                     | Beta milestone. |
| [Decision 002](./002-workflows-tech.md) — "Dry runs execute workflows with simulated trigger data"                                                                                                  | PoC ships **no** dry-run endpoint or UI button. The PoC itself is the safe no-send execution path.                                                                                                                                          | Beta milestone. |
| [Decision 002](./002-workflows-tech.md) — "Queue-backed execution introduces operational decisions around idempotency, retry policies, concurrency, worker count, horizontal scaling, and batching" | PoC runs one local BullMQ queue/worker. **No** idempotency keys, **no** retries, **no** batching, **no** backpressure. A failed step is a failed run.                                                                                       | Beta milestone. |
| [Decision 002](./002-workflows-tech.md) — "Webhook/API actions need explicit timeout, retry, latency tracking, and failure isolation"                                                               | PoC does not perform outbound webhook calls, so it tracks run-level timestamps/status/failure only. Per-action latency, timeout, retry visibility, and failure isolation are deferred.                                                      | Beta milestone. |
| [Business rule 001](../business-rules/001-workflows-glossary-and-scope.md) — "Idempotency is required for side-effect safety"                                                                       | PoC performs no real side effects. Idempotency remains required before real email/webhook execution.                                                                                                                                        | Beta milestone. |
| [Business rule 001](../business-rules/001-workflows-glossary-and-scope.md) — "Workflow runs must be observable through status, logs, elapsed time, failure reason, and relevant metadata"           | PoC ships status, timestamps, step outputs, and a single failure message. Structured per-step logs are stretch.                                                                                                                             | Beta milestone. |
| [Plan 001-002](../../cowork/plans/001-002-api-requirements-and-openapi-contract.md) — full endpoint inventory, OpenAPI generation, pagination, error model                                          | PoC implements only the minimum v3 HTTP endpoints needed for workflow CRUD, enable/disable, and run list/detail. Response Completed trigger enqueue is a server-only contract called from the response pipeline, not an exposed HTTP route. | Beta milestone. |
| [Plan 001-003](../../cowork/plans/001-003-workflow-schema-data-model-and-permissions.md) — JSONB indexes, version snapshots, complete permissions matrix                                            | PoC keeps separate workflow definition/run records but defers indexing, version snapshots, and broad permission-denial coverage.                                                                                                            | Beta milestone. |
| [Plan 001-004](../../cowork/plans/001-004-execution-engine-and-jobs.md) — idempotency, retries, concurrency, backpressure, batching                                                                 | PoC does none of these. The engine walks the graph, executes each step once, persists step output, and terminates the run.                                                                                                                  | Beta milestone. |
| [Plan 001-007](../../cowork/plans/001-007-run-observability-audit-and-dry-runs.md) — full audit log, dry-run API + UI, retention rules                                                              | Audit log: **not in PoC**. Dry run: **not in PoC**. Retention policy: **not in PoC**.                                                                                                                                                       | Beta milestone. |
| [Plan 001-008](../../cowork/plans/001-008-followups-webhooks-migration-and-qa.md) — Follow-ups and Webhooks reframed as workflows without regressions                                               | Existing Follow-ups and Webhooks continue to run untouched in their current form. No migration. PoC actions are no-send previews only.                                                                                                      | Beta milestone. |
| Milestone 001 Testing Strategy — Vitest for backend logic, Playwright E2E for crucial UI flows, i18n validation                                                                                     | PoC adds automated coverage for shared schema validation, graph execution/branching, minimal API behavior, and worker status transitions. **No** Playwright. **No** i18n run.                                                               | Beta milestone. |

### What Is Not a Shortcut

The following items are explicitly **not** deferred. They are PoC-required because the
PoC is built to validate them:

- Workflow JSON document validated by a zod schema.
- Minimal v3 route handlers for user-facing PoC operations.
- React Flow canvas, drawer, picker, and run inspector shaped per
  [design guidelines](../guidelines/design-guidelines-workflows.md).
- BullMQ-backed execution via `packages/jobs`.
- Separate workflow definition and workflow run records.
- The two state-machine vocabularies.
- The fixed Send Webhook preview envelope shape.
- Workspace-scoped data access at the query layer, even if the demo only exercises one
  workspace.
- No-send preview behavior for email and webhook actions.

## Consequences

- [Milestone 001](../milestones/001-workflows-mvp.md) points to a focused PoC
  implementation plan, `001-010`, as the clean stop point for demo and learning.
- [Decision 001](./001-workflows-api-first-backend-contract.md) and
  [Decision 002](./002-workflows-tech.md) keep their long-term posture. This decision
  narrows only the first implementation slice.
- Plans 001-002 through 001-009 remain the full MVP/Beta backlog. They should not be
  marked done when the PoC ships.
- Plan 001-010 orchestrates the PoC by referencing the relevant subsets of plans 001-000
  and 001-002 through 001-007, while explicitly deferring the 001-008 migration work.
- [Plan 001-001](../../cowork/plans/001-001-context-research-and-scope.md) is effectively
  complete: the research is already captured in this workbench. It should be flipped to
  `Done` once a checkpoint records that.
- [Plan 001-009](../../cowork/plans/001-009-mvp-feedback-and-beta-iteration.md) is
  reframed: it now validates PoC hypotheses, decides which long-term decisions survived
  contact, and scopes the Beta milestone.
- A checkpoint after Plan 001-010 decides what moves into Beta and whether a Milestone 002
  stub is needed.

## Alternatives Considered

- **Treat the MVP as a production rollout from day one.** Rejected because the timeline
  and staffing do not support it, and because we do not yet know which long-term
  decisions hold up under real usage. Building the prod plumbing first is the most
  expensive way to learn that a decision was wrong.
- **Skip the workbench docs and use simpler docs and from notes.** Rejected because the workbench is
  the artifact that lets future contributors (and LLMs) act without re-deciding
  everything. The PoC produces evidence that updates the workbench; it does not replace
  it.
- **Rewrite every existing plan into PoC and Beta phases.** Rejected because the existing
  plans remain useful as the production target. A single reference-based PoC orchestration
  plan creates a cleaner stop point with less documentation churn.
- **Quietly soften individual decisions without a decision record.** Rejected because the
  contradictions are load-bearing and need to be explicit. A future contributor reading
  Decision 001 in isolation should be told, on that page, that the PoC takes shortcuts.

## Follow-Ups

- Add Plan 001-010 as the focused PoC vertical slice implementation plan.
- Update Milestone 001 and `MILESTONES.md` so Plan 001-010 is the recommended active
  implementation plan after Plan 001-000.
- Keep Plans 001-002 through 001-009 as full MVP/Beta backlog plans.
- After the PoC ships, write a checkpoint listing which shortcuts caused real problems
  (so Beta knows what to prioritize) and which shortcuts could plausibly stay (so Beta
  does not over-build).
