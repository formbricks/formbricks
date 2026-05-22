# Plan: Context, Research, and Scope

| Field     | Value                                                                |
| --------- | -------------------------------------------------------------------- |
| Status    | Done                                                                 |
| Owner     | Javier Aguilar                                                       |
| Milestone | [001 Workflows MVP](../../blueprint/milestones/001-workflows-mvp.md) |

## Goal

Turn the Linear Workflows project, attached design/product context, Twenty research, and Javier's MVP
notes into a refined scope that separates must-ship MVP requirements from v2/beta candidates.

## Definition of Done

- Linear project context and referenced material are reviewed.
- Twenty workflow architecture is researched with emphasis on xyflow / React Flow and BullMQ.
- Scope 1 success criteria are sorted into MVP, stretch, v2, and explicit non-goals.
- Initial concept is presented to the Workflows team and challenged.
- Refined concept is captured in bullets and linked from the milestone before implementation starts.

## Out of Scope

- Coding the workflow engine.
- Creating production database migrations.
- Finalizing every API endpoint.
- Committing to AI Agent action for MVP.

## Phases

| Phase | Scope                                                                                     | Acceptance Checks                                                                           | Status |
| ----- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------ |
| A     | Read the Linear epic, Formbricks product context, and available design/research material. | Notes capture the business context and Scope 1 constraints without omitting open questions. | Done   |
| B     | Research Twenty workflow implementation and extract reusable technical ideas.             | Research notes identify relevant graph/canvas, queue, schema, and execution patterns.       | Done   |
| C     | Draft the initial MVP concept and split MVP/stretch/v2 choices.                           | Concept names triggers, actions, UI surfaces, API needs, and explicit non-goals.            | Done   |
| D     | Present to the Workflows team and incorporate challenge feedback.                         | Feedback is summarized with accepted changes and rejected alternatives.                     | Done   |
| E     | Final review pass.                                                                        | Milestone, decisions, and next plans are updated from the refined concept.                  | Done   |

## Completion Note

This bootstrap context plan is considered complete for the current workbench state. The Linear brief,
Javier's notes, reference screenshots, architecture direction, business rules, diagrams, MVP scope,
and external review feedback have been captured in the epic, milestone, decisions, business rules,
design guide, and drafted plan sequence.

The next actionable planning step is [001-000 PoC readiness and missing contracts](./001-000-prototype-readiness-and-contracts.md),
which resolves concrete implementation contracts before coding the PoC vertical slice.

## Research Inputs

- [Follow-ups email reference](../../research/images/followups-emails.png)
- [Twenty action choice reference](../../research/images/twenty-design-action-choice.png)
- [Workflow canvas reference](../../research/images/workflows-design-1.png)
- [Workflow controls reference](../../research/images/workflows-design-2-controls.png)
- [Workflow sidebar reference](../../research/images/workflows-sidebar.png)

## Test and Validation Plan

- Documentation-only plan. Validate by review against [E001 Workflows](../../blueprint/epics/E001-workflows.md),
  [001 Workflows MVP](../../blueprint/milestones/001-workflows-mvp.md), and team feedback.

## Manual QA Impact

No product QA yet. This plan defines the later manual QA scope for workflow creation, run inspection,
email/webhook side effects, and permission checks.

## Changelog Impact

Category: None

Note: Planning work only.

## Circuit Breakers

- Stop if referenced product/design materials are unavailable and scope would require guessing.
- Stop if team feedback contradicts accepted decisions without an explicit decision update.
- Stop if Twenty research reveals a major security or scaling issue that changes the MVP architecture.

## Risk Notes

- Scope can expand quickly because workflows are naturally broad. Keep the first concept focused on
  response/survey triggers, email/webhook actions, compute, if/else, and observable runs.

## Decision-Record Check

- Uses [001 Workflows API-first backend contract](../../blueprint/decisions/001-workflows-api-first-backend-contract.md).
- Uses [002 Workflows technical architecture](../../blueprint/decisions/002-workflows-tech.md).
- Create a new decision if research changes the engine, persistence, API, or security direction.

## Final Review

- Checks run and recorded.
- Workbench docs updated.
- Follow-ups captured.

- [x] Reviewed and refined by: Javier Aguilar
