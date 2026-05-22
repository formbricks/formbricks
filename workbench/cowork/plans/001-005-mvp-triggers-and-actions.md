# Plan: MVP Triggers and Actions

| Field     | Value                                                                |
| --------- | -------------------------------------------------------------------- |
| Status    | Proposed                                                             |
| Owner     | Javier Aguilar                                                       |
| Milestone | [001 Workflows MVP](../../blueprint/milestones/001-workflows-mvp.md) |

## Goal

Implement the MVP trigger and action library: response/survey triggers, Send Email, Send Webhook /
API Call, Compute / Calculate, and If/Else branching.

## Definition of Done

- Response Received, Response Completed, and Survey Completed trigger inputs are defined and wired.
- Send Email action can support the Follow-ups replacement path.
- Send Webhook / API Call action can call external HTTP endpoints with tracked status and latency.
  In the MVP the request body is a fixed JSON envelope whose `response` property holds the output of
  the previous action, or the trigger payload at the first step. The action config does not expose
  user-authored body templating.
- Compute / Calculate action supports constrained math/string operations using trigger or previous
  action data.
- If/Else branching can route execution based on known trigger data or prior step output.
- Structured action outputs are persisted and usable by later steps.
- AI Agent action is either implemented as an accepted stretch item or explicitly postponed.

## Out of Scope

- Webhook Received trigger.
- Collection loops/iterators.
- Delay/postpone.
- Human input/form step.
- Arbitrary JavaScript or arbitrary code execution.
- Encrypted storage or secret management for webhook/API headers and secrets.
- User-configurable Send Webhook / API Call body templating with variable expressions such as
  `$input.action_id` or `$input.response.score`. Documented as a planned post-MVP capability so the
  action contract is shaped to accommodate it later without redesign.

## Phases

| Phase | Scope                                                            | Acceptance Checks                                                                                  | Status   |
| ----- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------- |
| A     | Define trigger input schemas and sample payloads.                | Trigger payloads cover survey, response, contact/email, thank-you card, and metadata needs.        | Proposed |
| B     | Implement Send Email and Send Webhook / API Call action schemas. | Actions validate configs and expose structured output.                                             | Proposed |
| C     | Implement Compute / Calculate and If/Else.                       | Expressions are constrained and deterministic; branches produce inspectable run state.             | Proposed |
| D     | Decide and optionally implement AI Agent stretch action.         | Decision captures prompt variables, model selector, structured output, cost, and privacy concerns. | Proposed |
| E     | Final review pass.                                               | MVP action library is tested through API and worker execution.                                     | Proposed |

## Test and Validation Plan

- Unit tests for trigger payload schemas and action validation.
- Worker tests for action execution, structured output, and branch routing.
- Unit tests for dry-run trigger payload simulation and no-send action behavior.
- Integration tests for email/webhook side effects with mocked external boundaries.

## Manual QA Impact

Manual QA must cover each MVP action type in a real workflow run and confirm that action outputs and
failures appear in run detail.

## Changelog Impact

Category: Added

Note: Adds the first set of workflow triggers and actions.

## Circuit Breakers

- Stop if Compute / Calculate requires unsafe arbitrary code execution.
- Stop if webhook/API header or secret requirements expand beyond plain configurable headers and the
  MVP disclosure.
- Stop if AI Agent action changes privacy, cost, or reliability assumptions without a decision update.

## Risk Notes

- Trigger payload shape will become a long-lived contract. Keep it stable, explicit, and documented.

## Design Reference

- [Workflows Builder design guidelines](../../blueprint/guidelines/design-guidelines-workflows.md) —
  source of truth for trigger and action chip categories, node anatomy, drawer-based action
  configuration, and the MVP webhook envelope disclosure pattern. Any trigger or action whose config
  exposes UI must follow it.

## Decision-Record Check

- Uses [002 Workflows technical architecture](../../blueprint/decisions/002-workflows-tech.md).
- Future decision likely needed for AI Agent action inclusion and provider/model policy.

## Final Review

- Checks run and recorded.
- Workbench docs updated.
- Follow-ups captured.

- [x] Reviewed and refined by: Javier Aguilar
