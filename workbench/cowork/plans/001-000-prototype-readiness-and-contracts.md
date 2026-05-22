# Plan: PoC Readiness and Missing Contracts

| Field     | Value                                                                |
| --------- | -------------------------------------------------------------------- |
| Status    | Done                                                                 |
| Owner     | Javier Aguilar                                                       |
| Milestone | [001 Workflows MVP](../../blueprint/milestones/001-workflows-mvp.md) |

## Goal

Resolve the concrete implementation contracts that are still missing before starting the Workflows
PoC/demo vertical slice.

The workbench already has strong product, architecture, design, and testing direction. This plan turns
the remaining open implementation questions into small, reviewable artifacts so a coding agent or
human developer can build the PoC without re-deciding core architecture mid-stream.

## Definition of Done

- A PoC scope cut exists and explicitly distinguishes the demo vertical slice from the full MVP/Beta
  target.
- Endpoint inventory exists for the PoC and identifies the later MVP/Beta endpoints it intentionally
  defers.
- Workflow JSON zod schema sketch exists, including trigger, action, branch, compute, run, and any
  deferred dry-run request shapes needed to keep the Beta contract visible.
- The imported initial prototype logic has been reviewed as a concept reference, with reusable ideas,
  required renames, and known gaps called out before implementation begins.
- Prisma/table sketch exists with column names, JSONB fields, indexes, relations, and deletion/retention
  notes for workflow definitions, runs, and minimal audit/run-log data.
- BullMQ specifics are documented: queue/job names, payload shape, processor location, worker ownership,
  and PoC concurrency/default behavior.
- Dashboard IA placement is decided for the PoC so UI work can start without navigation churn.
- Response Completed trigger hook is identified in the existing response pipeline, including where the
  workflow matcher attaches and what payload it receives.
- Plan 001-001 is either closed as completed bootstrap context or explicitly replaced by this readiness
  plan.

## Out of Scope

- Implementing workflow code.
- Creating production Prisma migrations.
- Building the React Flow UI.
- Implementing real Send Email or Send Webhook side effects.
- Adding idempotency, retry policy, audit completeness, production worker topology, OpenAPI generation,
  or Playwright E2E beyond what is needed to define their future contracts.
- Weakening the accepted API-first decision without a new decision record. The default PoC path
  remains v3 route handlers from day one.

## Phases

| Phase | Scope                                    | Acceptance Checks                                                                                                                                                                                                                                      | Status |
| ----- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| A     | Write the PoC scope cut.                 | The slice names one trigger, one branch path, no-send action previews, run list/detail, and explicit post-PoC deferrals.                                                                                                                               | Done   |
| B     | Produce the endpoint inventory.          | CRUD/list/detail/lifecycle/run-list/run-detail routes are named with method, path, request shape, response shape, auth level, and PoC/MVP status; the trigger-enqueue contract is documented as server-only; dry-run routes are marked Beta-deferred.  | Done   |
| C     | Sketch shared workflow schemas.          | Client-safe zod schemas cover workflow JSON, trigger/action configs, lifecycle values, run statuses, and any deferred dry-run payload shape without server-only imports; useful ideas from the initial prototype are mapped or intentionally rejected. | Done   |
| D     | Sketch persistence and BullMQ contracts. | Tables/indexes/relations and queue/job/payload/processor locations are concrete enough to implement without inventing names during coding.                                                                                                             | Done   |
| E     | Resolve IA and trigger hook.             | Sidebar placement is chosen for the PoC, and the exact existing response completion path/matcher insertion point is documented.                                                                                                                        | Done   |
| F     | Final review pass.                       | Milestone, prompt, and downstream plans reference the new readiness artifacts; open decisions are either accepted, deferred, or escalated.                                                                                                             | Done   |

## Required Artifacts

Create or update the smallest durable records needed for the answers above. Suggested locations:

- `workbench/research/docs/workflows-prototype-scope.md` — PoC cut and demo boundaries.
- `workbench/research/docs/workflows-api-endpoint-inventory.md` — endpoint inventory.
- `workbench/research/docs/workflows-schema-sketch.md` — shared zod schema sketch and module placement.
- `workbench/research/docs/workflows-data-and-jobs-sketch.md` — Prisma/table sketch plus BullMQ job contract.
- `workbench/research/docs/workflows-trigger-hook-and-ia.md` — Response Completed hook and navigation decision.

## Reference Inputs

- `workbench/research/workflows-proto-logic/` — imported logic from the earlier
  `itsjavi/formbricks-workflows` prototype. Use it as a concept reference for schema shape, refs,
  validation, action descriptors, AI generation, and editor state patterns. Do not copy it verbatim:
  align trigger names, lifecycle status (`draft`, `enabled`, `disabled`), run status vocabulary,
  graph/version/run persistence, API-first constraints, and Formbricks package boundaries before
  promoting any code into the product.

If a finding becomes durable product or architecture truth, promote it into the appropriate blueprint
decision, business rule, diagram, design guide, or milestone section instead of leaving it only in
research.

## Completion Note

Completed on 2026-05-22 as documentation/research work only. Created the five readiness artifacts:

- [workflows-prototype-scope.md](../../research/docs/workflows-prototype-scope.md)
- [workflows-api-endpoint-inventory.md](../../research/docs/workflows-api-endpoint-inventory.md)
- [workflows-schema-sketch.md](../../research/docs/workflows-schema-sketch.md)
- [workflows-data-and-jobs-sketch.md](../../research/docs/workflows-data-and-jobs-sketch.md)
- [workflows-trigger-hook-and-ia.md](../../research/docs/workflows-trigger-hook-and-ia.md)

The codebase inspection found the Response Completed hook in the existing response pipeline
(`responseFinished`), the v3 route wrapper/workspace auth pattern, current shared zod schema placement,
Prisma JSONB/table/index conventions, BullMQ job registration/override patterns, main dashboard navigation
patterns, and reusable dashboard form/table/drawer/condition components.

Plan 001-010 should consume these artifacts after human review. No workflow implementation has started.

## Test and Validation Plan

- Documentation-only plan. Validate by review against:
  - [001 Workflows MVP](../../blueprint/milestones/001-workflows-mvp.md)
  - [Decision 001 — API-first backend contract](../../blueprint/decisions/001-workflows-api-first-backend-contract.md)
  - [Decision 002 — Workflows technical architecture](../../blueprint/decisions/002-workflows-tech.md)
  - [Architecture diagrams](../../research/docs/diagrams.md)
  - [Workflows design guidelines](../../blueprint/guidelines/design-guidelines-workflows.md)
- No `pnpm` checks are required unless implementation files are changed.
- If implementation starts immediately after this plan, use [CHECKS.md](../../blueprint/CHECKS.md) for
  the real verification commands.

## Manual QA Impact

No direct product QA yet. This plan should define which PoC flows later need manual QA coverage:

- Create/edit workflow.
- Enable/disable/re-enable/return-to-draft.
- Dry-run with simulated Response Completed trigger data if it is promoted into the Beta scope.
- Run list/detail inspection.
- Validation error visibility.
- No-send email/webhook preview behavior.

Update [MANUAL_QA.md](../../blueprint/MANUAL_QA.md) when those flows become implemented behavior.

## Changelog Impact

Category: None

Note: Planning/readiness work only. No release-visible behavior until implementation begins.

## Circuit Breakers

- Stop if the PoC would require bypassing the accepted API-first decision, using Next.js server
  actions for workflow behavior, or creating dashboard-only workflow behavior. Those are not allowed
  PoC shortcuts.
- Stop if shared schemas cannot be designed as browser-safe modules.
- Stop if imported prototype code is being copied without reconciling it with the accepted workflow lifecycle,
  run statuses, API-first contract, and current Formbricks package structure.
- Stop if Response Completed cannot be located cleanly in the existing response pipeline.
- Stop if the data model sketch would require irreversible migration choices before the PoC is
  validated.
- Stop if the PoC scope expands into real side-effect delivery before idempotency/retry behavior
  is planned.
- Stop if IA placement cannot be decided without broader product review.

## Risk Notes

- The biggest risk is building production-grade infrastructure before a clickable architecture proof
  exists. This plan should keep the PoC thin while preserving the API-first shape.
- The opposite risk is building a throwaway demo that violates the accepted architecture and must be
  rewritten. The PoC may defer hardening, but it must not deviate from API-first workflow behavior.
- Endpoint and schema sketches should be concrete enough for implementation, but not treated as final
  production hardening until the PoC proves the shape.
- The initial prototype logic is valuable as a starting concept, but it predates this workbench's
  contracts and should be treated as reference material, not source-of-truth architecture.

## Decision-Record Check

- Uses [001 Workflows API-first backend contract](../../blueprint/decisions/001-workflows-api-first-backend-contract.md).
- Uses [002 Workflows technical architecture](../../blueprint/decisions/002-workflows-tech.md).
- Do not create a workaround decision for Next.js server actions, dashboard-only workflow behavior,
  or bypassing the v3 API. Those paths are rejected for Workflows.
- Create a new decision only if the PoC changes persistence away from JSONB-backed definitions/runs
  or settles a durable IA/navigation policy.
- Create a new decision if the Response Completed trigger hook changes the broader response pipeline
  architecture.

## Documentation Updates

- Updated [001 Workflows MVP](../../blueprint/milestones/001-workflows-mvp.md) with 001-000 completion status and
  001-010 as the review-gated next implementation path.
- Updated [MILESTONES.md](../../blueprint/MILESTONES.md) so 001-010 is the recommended next plan after review.
- Updated [workflows-prototype-vertical-slice.txt](../prompts/workflows-prototype-vertical-slice.txt)
  so fresh agents start from these readiness artifacts.
- Promote durable outcomes to decisions, business rules, diagrams, or design guidelines when needed.

## Final Review

- Required artifacts created or updated.
- Open questions resolved, deferred, or escalated.
- Follow-up implementation order is clear.
- Workbench docs updated.

- [x] Reviewed and refined by: Javier Aguilar
