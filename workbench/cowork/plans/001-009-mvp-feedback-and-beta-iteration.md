# Plan: PoC Feedback and Beta Iteration

| Field     | Value                                                                |
| --------- | -------------------------------------------------------------------- |
| Status    | Proposed                                                             |
| Owner     | Javier Aguilar                                                       |
| Milestone | [001 Workflows MVP](../../blueprint/milestones/001-workflows-mvp.md) |

## Goal

Review the Workflows PoC after [001-010 Workflows PoC vertical slice](./001-010-workflows-poc-vertical-slice.md),
gather feedback from the Workflows team and early users where available, and convert the learnings
into the next Beta / production-grade milestone.

## Definition of Done

- PoC acceptance from [001-010](./001-010-workflows-poc-vertical-slice.md) has been checked and a
  checkpoint exists.
- Workflows team has reviewed the PoC against the refined concept and the architecture hypotheses.
- Feedback is grouped into bugs, PoC blockers, Beta requirements, and v2 ideas.
- Beta production plan is drafted with any needed decisions or business-rule updates.
- Post-MVP iteration candidates are ranked: AI Agent, loops, delays, human input, webhook-received
  triggers, version UI, batching, dry-runs, real email/webhook execution, idempotency, retries,
  audit, OpenAPI, Playwright, and stronger webhook auth/secrets.

## Out of Scope

- Shipping every v2 idea.
- Treating exploratory feedback as accepted product behavior without a plan or decision update.
- Expanding beta scope without revisiting risks and operational requirements.

## Phases

| Phase | Scope                                                | Acceptance Checks                                                        | Status   |
| ----- | ---------------------------------------------------- | ------------------------------------------------------------------------ | -------- |
| A     | Prepare PoC review.                                  | 001-010 acceptance, demo notes, checks, and known limitations are ready. | Proposed |
| B     | Gather Workflows team feedback.                      | Feedback is captured with clear action categories.                       | Proposed |
| C     | Gather early user/customer feedback where available. | Feedback identifies usability, automation, API, and reliability gaps.    | Proposed |
| D     | Draft beta production plan.                          | Next milestone includes decisions, risks, and validation strategy.       | Proposed |
| E     | Final review pass.                                   | PoC is either accepted for beta path or blockers are documented.         | Proposed |

## Test and Validation Plan

- Run or review the checks required by [001-010](./001-010-workflows-poc-vertical-slice.md).
- Confirm shared schema validation, graph execution, minimal API behavior, and worker status
  transitions have automated coverage.
- Confirm no TSX/component unit tests were added for workflow UI.
- Confirm the manual PoC demo flow was completed and recorded.
- Do not require OpenAPI generation, Playwright, i18n validation, dry-run coverage, real side-effect
  tests, retry/idempotency tests, or audit tests for this PoC review.

## Manual QA Impact

Manual PoC demo results should be summarized into the Beta plan, including workflow creation,
activation/disable behavior, Response Completed trigger enqueue, no-send preview outputs, failure
states, and run inspection. Full browser coverage, dry-run trigger simulation, real email/webhook
side-effect validation, permissions hardening, and migration QA belong to Beta planning.

## Changelog Impact

Category: Added

Note: Captures the Workflows PoC review and next Beta iteration.

## Circuit Breakers

- Stop if PoC acceptance criteria are not met.
- Stop if manual QA uncovers data leakage, accidental real side effects, or worker instability.
- Stop if feedback requires a durable change that is not reflected in a decision, business rule, or
  next plan.

## Risk Notes

- Workflows can become a platform inside the product. Beta planning should protect the PoC from
  immediately absorbing every automation use case.

## Decision-Record Check

- Review whether real Send Email/Webhook execution, idempotency/retry policy, audit posture, dry-run
  behavior, OpenAPI parity, AI Agent action, batching, version UI, or webhook secret handling need new
  decisions before Beta work begins.

## Final Review

- Checks run and recorded.
- Workbench docs updated.
- Follow-ups captured.

- [x] Reviewed and refined by: Javier Aguilar
